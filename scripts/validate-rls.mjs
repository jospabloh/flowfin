#!/usr/bin/env node
/**
 * validate-rls.mjs — static guard for Base44 Row-Level Security correctness.
 *
 * Multi-tenant isolation in Base44 has TWO halves and getting either wrong fails
 * SILENTLY (see the ACACIA portfolio post-mortems):
 *
 *   - Entity side (left of a rule): a custom field MUST be addressed as `data.<f>`
 *     or be a built-in (id, _id, created_by_id, created_date, updated_date). A
 *     bare key (e.g. `tenant_id`) points at nothing → the clause matches EVERY
 *     row → RLS OFF (cross-tenant leak).
 *   - User side (the template, right of a rule): custom user fields resolve as
 *     `{{user.data.<f>}}`. The only bare built-ins are {{user.id}}, {{user.email}},
 *     {{user.role}}. `{{user.tenant_id}}` resolves to nothing → matches ZERO rows
 *     → every tenant sees an empty app.
 *
 * This script parses every base44/entities/*.jsonc and FAILS CI on either class
 * of error.
 *
 * NOTE: it does NOT flag a missing service-role (`role: admin`) $or branch. That
 * branch is needed only on the specific entities a backend `asServiceRole`
 * function reads/writes — which is not statically decidable from the schema, so
 * a heuristic over-fires (every tenant-scoped entity, most of them end-user
 * only). Keep that review manual; this guard stays focused on the two silent,
 * always-wrong classes above so every failure it reports is actionable.
 *
 * A third, separate check guards against the 2026-07-08 incident: a same-day
 * "Apply RLS security recommendations" pass (commit 2d1a113) silently collapsed
 * `read` on ~20 family/tenant-scoped entities down to platform-admin-only,
 * deleting the {{user.data.family_id}} (or equivalent owner-field) branch that
 * let a family's own members read their own data. Every rule stayed
 * syntactically valid — the two checks above didn't fire — so it went
 * undetected in production for 9 days until a user complained she couldn't
 * see her data. `checkReadNotAdminOnly` flags any entity carrying a
 * `family_id` or `admin_user_id` field whose `read` rule reduces to
 * admin-only, with no alternate branch for a family member/owner.
 *
 * Run: node scripts/validate-rls.mjs   (also: npm run validate:rls)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTITIES_DIR = join(__dirname, '..', 'base44', 'entities');

// `_id` is the Base44/Mongo record-id alias and is a legitimate built-in.
const BUILTIN_ENTITY_FIELDS = new Set(['id', '_id', 'created_by_id', 'created_date', 'updated_date']);
const BUILTIN_USER_TEMPLATES = new Set(['{{user.id}}', '{{user.email}}', '{{user.role}}']);
const OPS = ['create', 'read', 'update', 'delete'];

/** Strip // and block comments so JSONC parses as JSON. */
function parseJsonc(text) {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const noLine = noBlock.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return JSON.parse(noLine);
}

const errors = [];

function checkUserTemplate(value, ctx) {
  if (typeof value !== 'string') return;
  const matches = value.match(/\{\{\s*user[^}]*\}\}/g) || [];
  for (const tpl of matches) {
    const normalized = tpl.replace(/\s+/g, '');
    if (BUILTIN_USER_TEMPLATES.has(normalized)) continue;
    if (/^\{\{user\.data\.[\w.]+\}\}$/.test(normalized)) continue;
    errors.push(`${ctx}: invalid user template "${tpl}" — custom user fields must be {{user.data.<field>}}; only {{user.id}}, {{user.email}}, {{user.role}} are bare built-ins.`);
  }
}

function checkEntityKey(key, ctx) {
  if (key.startsWith('$') || key === 'user_condition') return;
  if (BUILTIN_ENTITY_FIELDS.has(key)) return;
  if (key.startsWith('data.')) return;
  errors.push(`${ctx}: invalid entity field path "${key}" — custom fields must be "data.${key}" (a bare key matches every row and disables RLS).`);
}

function walkRule(node, ctx) {
  if (Array.isArray(node)) {
    node.forEach((n, i) => walkRule(n, `${ctx}[${i}]`));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'user_condition') continue;
      if (key === '$or' || key === '$and' || key === '$in' || key === '$nin') {
        walkRule(value, `${ctx}.${key}`);
        continue;
      }
      checkEntityKey(key, ctx);
      checkUserTemplate(value, `${ctx}.${key}`);
    }
  }
}

/**
 * True if `rule` grants read access to platform admins ONLY, with no branch
 * a family member or record owner could ever satisfy. A bare `user_condition`
 * leaf is admin-only. An `$or` is admin-only only if every branch is. An
 * `$and` is treated as admin-only if any branch is (all sub-conditions,
 * including the admin one, must hold, so a non-admin can never pass it).
 * Any other leaf (a `data.<field>` comparison) is a real non-admin path.
 */
function isAdminOnlyRule(rule) {
  if (!rule || typeof rule !== 'object') return false;
  if (Array.isArray(rule)) return rule.every(isAdminOnlyRule);
  const keys = Object.keys(rule);
  if (keys.length === 1 && keys[0] === 'user_condition') return true;
  if (keys.includes('$or')) return rule.$or.every(isAdminOnlyRule);
  if (keys.includes('$and')) return rule.$and.some(isAdminOnlyRule);
  return false;
}

// Entities that legitimately keep `read` platform-admin-only despite carrying
// a family_id field: they're written and read exclusively by asServiceRole
// backend functions, never queried directly by an end-user client. Add here
// ONLY with a one-line reason — this is the audit trail the incident lacked.
const ADMIN_ONLY_READ_ALLOWLIST = new Map([
  ['EmailNotification.jsonc', 'internal billing/lifecycle email queue — written and read only by asServiceRole functions (checkAccountLifecycle), never by end-user clients'],
]);

function checkReadNotAdminOnly(schema, file) {
  const props = schema.properties || {};
  const isFamilyScoped = 'family_id' in props || 'admin_user_id' in props;
  if (!isFamilyScoped) return;
  if (ADMIN_ONLY_READ_ALLOWLIST.has(file)) return;
  const readRule = schema.rls && schema.rls.read;
  if (!readRule) return; // no read rule at all is a different (missing-RLS) problem
  if (isAdminOnlyRule(readRule)) {
    errors.push(
      `${file}: rls.read grants access to platform admins only — this entity has a ` +
      `family_id/admin_user_id field, so its own family members/owner must also have a ` +
      `read path (e.g. "data.family_id": "{{user.data.family_id}}" or an owner field ` +
      `compared to "{{user.id}}"). If this is genuinely meant to be admin-only, remove ` +
      `the family_id/admin_user_id field or add an explicit allow-list exception here.`
    );
  }
}

const files = readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.jsonc'));
if (files.length === 0) {
  console.error('validate:rls — no entity files found in base44/entities');
  process.exit(1);
}

for (const file of files) {
  let schema;
  try {
    schema = parseJsonc(readFileSync(join(ENTITIES_DIR, file), 'utf8'));
  } catch (e) {
    errors.push(`${file}: not valid JSONC — ${e.message}`);
    continue;
  }
  const rls = schema.rls || {};
  // Entity-level RLS
  for (const op of OPS) {
    if (!rls[op]) continue;
    walkRule(rls[op], `${file}:rls.${op}`);
  }
  checkReadNotAdminOnly(schema, file);
  // Field-level RLS
  for (const [fname, fdef] of Object.entries(schema.properties || {})) {
    if (fdef && fdef.rls) {
      for (const op of Object.keys(fdef.rls)) {
        walkRule(fdef.rls[op], `${file}:${fname}.rls.${op}`);
      }
    }
  }
}

if (errors.length) {
  console.error(`\n❌ validate:rls failed with ${errors.length} error(s):`);
  for (const e of errors) console.error(`   • ${e}`);
  process.exit(1);
}
console.log(`✅ validate:rls — ${files.length} entities OK.`);
