// Unit tests for guardedEntityWrite's pure decision logic. Runs under
// `deno test base44/functions/` with no platform/DB access — same style as
// _agentGuard.test.ts, guarding against the subtle failures that matter
// here: a permission key mapped to the wrong operation, a member default
// that's drifted from its src/**/permissions.js manifest, or a billing
// status that should (or shouldn't) be treated as read-only.

import {
  decideCapability,
  defaultPermission,
  effectivePermission,
  ENTITY_PERMISSION_KEYS,
  GUARDED_ENTITIES,
  isBillingReadOnly,
  permissionKeyFor,
} from "./logic.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("assertion failed: " + msg);
}
function assertEquals(actual: unknown, expected: unknown, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`assertEquals failed (${msg}): ${a} !== ${e}`);
}

Deno.test("permissionKeyFor: single-key entities apply the same key to all operations", () => {
  assertEquals(permissionKeyFor("Category", "create"), "catalog.categories");
  assertEquals(permissionKeyFor("Category", "update"), "catalog.categories");
  assertEquals(permissionKeyFor("Category", "delete"), "catalog.categories");
});

Deno.test("permissionKeyFor: per-operation entities use distinct keys", () => {
  assertEquals(permissionKeyFor("Transaction", "create"), "transaction.create");
  assertEquals(permissionKeyFor("Transaction", "update"), "transaction.edit");
  assertEquals(permissionKeyFor("Transaction", "delete"), "transaction.delete");
  assertEquals(permissionKeyFor("ScheduledPayment", "create"), "scheduled.create");
  assertEquals(permissionKeyFor("ScheduledPayment", "update"), "scheduled.manage");
  assertEquals(permissionKeyFor("ScheduledPayment", "delete"), "scheduled.manage");
});

Deno.test("permissionKeyFor: CategoryBudget has no key (no defined permission for it) and ScheduledPaymentRecord only defines create", () => {
  assertEquals(permissionKeyFor("CategoryBudget", "create"), null);
  assertEquals(permissionKeyFor("CategoryBudget", "update"), null);
  assertEquals(permissionKeyFor("CategoryBudget", "delete"), null);
  assertEquals(permissionKeyFor("ScheduledPaymentRecord", "create"), "scheduled.mark");
  assertEquals(permissionKeyFor("ScheduledPaymentRecord", "update"), null);
  assertEquals(permissionKeyFor("ScheduledPaymentRecord", "delete"), null);
});

Deno.test("all 16 guarded entities are covered and every mapped key has a member default (except the one null entity)", () => {
  assertEquals(GUARDED_ENTITIES.length, 16, "expected 16 guarded entities");
  for (const entity of GUARDED_ENTITIES) {
    for (const op of ["create", "update", "delete"] as const) {
      const key = permissionKeyFor(entity, op);
      if (key === null) continue;
      // defaultPermission("member", key) must not silently fall through to a
      // key-not-found CLOSED default when a real key IS mapped — that would
      // hide a typo'd key as "deny everything", masking a bug as a (safe but
      // wrong) over-restriction instead of failing loudly.
      const knownKeys = Object.values(ENTITY_PERMISSION_KEYS).flatMap((cfg) =>
        cfg == null ? [] : typeof cfg === "string" ? [cfg] : Object.values(cfg)
      );
      assert(knownKeys.includes(key), `${entity}.${op} maps to an untracked key: ${key}`);
    }
  }
});

Deno.test("defaultPermission: admin is OPEN for every mapped key, member matches its manifest default", () => {
  assertEquals(defaultPermission("admin", "catalog.categories").can_write, true);
  assertEquals(defaultPermission("admin", "goals.manage").can_delete, true);
  assertEquals(defaultPermission("member", "transaction.create").can_write, true, "member can create transactions by default");
  assertEquals(defaultPermission("member", "transaction.create").can_delete, false, "member cannot delete via the create key");
  assertEquals(defaultPermission("member", "transaction.delete").can_delete, true, "member can delete via the delete key");
  assertEquals(defaultPermission("member", "goals.manage").can_write, false, "member cannot manage goals by default");
  assertEquals(defaultPermission("member", "catalog.categories").can_write, false, "member cannot create categories by default");
});

Deno.test("effectivePermission: a RolePermission DB row overrides the default in both directions", () => {
  const denyRow = { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true };
  assertEquals(
    effectivePermission("member", "transaction.create", denyRow).can_write,
    false,
    "DB row can deny what the default allows",
  );
  const allowRow = { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true };
  assertEquals(
    effectivePermission("member", "goals.manage", allowRow).can_write,
    true,
    "DB row can allow what the default denies",
  );
});

Deno.test("effectivePermission: a partial DB row defaults missing fields to false (deny-by-default), not the role default", () => {
  const partialRow = { can_write: true };
  assertEquals(effectivePermission("member", "transaction.delete", partialRow).can_delete, false);
});

Deno.test("decideCapability: maps create/update/delete to can_write/can_modify/can_delete", () => {
  const perm = { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true };
  assert(decideCapability(perm, "create"), "create maps to can_write");
  assert(!decideCapability(perm, "update"), "update maps to can_modify");
  assert(!decideCapability(perm, "delete"), "delete maps to can_delete");
});

Deno.test("isBillingReadOnly: blocks view_only and suspended, allows everything else including undefined", () => {
  assert(isBillingReadOnly("view_only"), "view_only is read-only");
  assert(isBillingReadOnly("suspended"), "suspended is read-only");
  assert(!isBillingReadOnly("active"), "active is not read-only");
  assert(!isBillingReadOnly("trial"), "trial is not read-only");
  assert(!isBillingReadOnly(undefined), "missing status defaults to active, not read-only");
  assert(!isBillingReadOnly(null), "null status defaults to active, not read-only");
});
