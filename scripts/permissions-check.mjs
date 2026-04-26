#!/usr/bin/env node
/**
 * permissions-check.mjs
 * Validates that every permission key used in source code is declared in a manifest.
 *
 * Usage:
 *   node scripts/permissions-check.mjs          # exits 1 if any missing keys
 *   node scripts/permissions-check.mjs --report # also writes docs/permissions-coverage.md
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC  = join(ROOT, 'src');

const REPORT_FLAG = process.argv.includes('--report');

// ---------------------------------------------------------------------------
// 1. Walk src/**/*.{js,jsx} and extract used permission keys
// ---------------------------------------------------------------------------
async function walkFiles(dir, ext = ['.js', '.jsx']) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true }).catch(() => []);
  const files = [];
  for (const e of entries) {
    if (e.isFile() && ext.some(x => e.name.endsWith(x))) {
      files.push(join(e.parentPath ?? e.path ?? dir, e.name));
    }
  }
  return files;
}

// Fallback for older Node versions that don't support { recursive: true }
async function walkFilesRecursive(dir, ext = ['.js', '.jsx']) {
  const files = [];
  async function recurse(current) {
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const full = join(current, e.name);
      if (e.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build'].includes(e.name)) {
          await recurse(full);
        }
      } else if (e.isFile() && ext.some(x => e.name.endsWith(x))) {
        files.push(full);
      }
    }
  }
  await recurse(dir);
  return files;
}

const USED_KEY_RE = /use(?:Permission|CanView)\(\s*['"]([^'"]+)['"]/g;

async function extractUsedKeys(files) {
  const used = new Map(); // key -> [{file, line}]
  for (const file of files) {
    // Skip manifest files themselves and the aggregator/registry
    if (file.includes('/permissions/') && (file.endsWith('.permissions.js') || file.endsWith('/permissions.js') || file.includes('aggregator') || file.includes('registry') || file.includes('columns') || file.includes('usePermission'))) continue;
    const src = await readFile(file, 'utf8').catch(() => '');
    const lines = src.split('\n');
    lines.forEach((line, idx) => {
      let m;
      const re = new RegExp(USED_KEY_RE.source, 'g');
      while ((m = re.exec(line)) !== null) {
        const key = m[1];
        if (!used.has(key)) used.set(key, []);
        used.get(key).push({ file: file.replace(ROOT + '/', ''), line: idx + 1 });
      }
    });
  }
  return used;
}

// ---------------------------------------------------------------------------
// 2. Load declared keys from manifests (Node-compatible, no import.meta.glob)
// ---------------------------------------------------------------------------
async function loadDeclaredKeys() {
  const declared = new Map(); // key -> { kind, label, moduleKey, defaultAdmin, defaultMember }

  // Helper to process a single manifest object
  function processManifest(manifest) {
    if (!manifest || typeof manifest !== 'object') return;
    const { module: mod, sections = [], actions = [], defaults = {} } = manifest;
    if (mod) {
      declared.set(mod.key, { kind: 'module', label: mod.label, moduleKey: mod.key, defaultAdmin: null, defaultMember: null });
    }
    for (const sec of sections) {
      declared.set(sec.key, {
        kind: 'section', label: sec.label, moduleKey: mod?.key,
        defaultAdmin: defaults.admin?.[sec.key] ?? null,
        defaultMember: defaults.member?.[sec.key] ?? null,
      });
    }
    for (const act of actions) {
      declared.set(act.key, {
        kind: 'action', label: act.label, moduleKey: mod?.key,
        defaultAdmin: defaults.admin?.[act.key] ?? null,
        defaultMember: defaults.member?.[act.key] ?? null,
      });
    }
  }

  // Glob component manifests: src/components/*/permissions.js
  const compDir = join(SRC, 'components');
  const compEntries = await readdir(compDir, { withFileTypes: true }).catch(() => []);
  for (const e of compEntries) {
    if (!e.isDirectory()) continue;
    const manifestPath = join(compDir, e.name, 'permissions.js');
    if (!existsSync(manifestPath)) continue;
    try {
      const mod = await import(pathToFileURL(manifestPath).href);
      const def = mod.default;
      if (Array.isArray(def)) def.forEach(processManifest);
      else processManifest(def);
    } catch (err) {
      console.warn(`  Warning: could not load ${manifestPath}: ${err.message}`);
    }
  }

  // Glob page manifests: src/pages/permissions/*.permissions.js
  const pagePermDir = join(SRC, 'pages', 'permissions');
  if (existsSync(pagePermDir)) {
    const pageEntries = await readdir(pagePermDir, { withFileTypes: true }).catch(() => []);
    for (const e of pageEntries) {
      if (!e.isFile() || !e.name.endsWith('.permissions.js')) continue;
      const manifestPath = join(pagePermDir, e.name);
      try {
        const mod = await import(pathToFileURL(manifestPath).href);
        const def = mod.default;
        if (Array.isArray(def)) def.forEach(processManifest);
        else processManifest(def);
      } catch (err) {
        console.warn(`  Warning: could not load ${manifestPath}: ${err.message}`);
      }
    }
  }

  return declared;
}

// ---------------------------------------------------------------------------
// 3. Diff and report
// ---------------------------------------------------------------------------
function perm(p) {
  if (!p) return '—';
  const on = [];
  if (p.can_read)   on.push('R');
  if (p.can_write)  on.push('W');
  if (p.can_modify) on.push('M');
  if (p.can_delete) on.push('D');
  if (p.can_view)   on.push('V');
  return on.length ? on.join('') : 'none';
}

async function main() {
  console.log('🔍 FlowFin permissions check...\n');

  const files = await walkFilesRecursive(SRC);
  const usedKeys = await extractUsedKeys(files);
  const declaredKeys = await loadDeclaredKeys();

  // Only check leaf action keys (kind === 'action') as required
  // module.* and section keys are structural — they CAN be used but are not required
  const declaredActionKeys = new Set(
    [...declaredKeys.entries()]
      .filter(([, v]) => v.kind === 'action')
      .map(([k]) => k)
  );
  const declaredAllKeys = new Set(declaredKeys.keys());

  const usedKeySet = new Set(usedKeys.keys());

  // missing = used \ declared (any key used in code but not in any manifest)
  const missing = [...usedKeySet].filter(k => !declaredAllKeys.has(k));

  // orphan = declared action keys \ used (declared but never consumed in code)
  const orphans = [...declaredActionKeys].filter(k => !usedKeySet.has(k));

  let hasErrors = false;

  if (missing.length > 0) {
    hasErrors = true;
    console.error('❌ Permission keys used but NOT declared in any manifest:\n');
    for (const key of missing) {
      const usages = usedKeys.get(key) || [];
      for (const u of usages) {
        console.error(`   - ${key}`);
        console.error(`     used in ${u.file}:${u.line}`);
      }
      // Suggest a manifest entry
      const prefix = key.split('.')[0];
      const suggestedManifest = `src/components/${prefix}/permissions.js or src/pages/permissions/${prefix}.permissions.js`;
      console.error(`     Add to ${suggestedManifest}:`);
      console.error(`       actions: [{ key: '${key}', parent: '<section_key>', label: '<Label>' }]`);
      console.error('');
    }
  } else {
    console.log('✅ All used permission keys are declared.\n');
  }

  if (orphans.length > 0) {
    console.warn(`⚠️  ${orphans.length} declared action keys are not used in code (orphans):`);
    for (const k of orphans.slice(0, 20)) {
      console.warn(`   - ${k}`);
    }
    if (orphans.length > 20) console.warn(`   ... and ${orphans.length - 20} more`);
    console.warn('');
  }

  console.log(`📊 Summary:`);
  console.log(`   Declared keys: ${declaredAllKeys.size} (${declaredActionKeys.size} actions)`);
  console.log(`   Used keys:     ${usedKeySet.size}`);
  console.log(`   Missing:       ${missing.length}`);
  console.log(`   Orphans:       ${orphans.length}`);

  // ---------------------------------------------------------------------------
  // 4. Coverage report
  // ---------------------------------------------------------------------------
  if (REPORT_FLAG) {
    const docsDir = join(ROOT, 'docs');
    await mkdir(docsDir, { recursive: true });

    // Group declared keys by module
    const moduleGroups = new Map();
    for (const [key, meta] of declaredKeys.entries()) {
      if (meta.kind === 'module') {
        if (!moduleGroups.has(key)) moduleGroups.set(key, { meta, actions: [] });
      }
    }
    for (const [key, meta] of declaredKeys.entries()) {
      if (meta.kind === 'action') {
        const mod = meta.moduleKey;
        if (!moduleGroups.has(mod)) moduleGroups.set(mod, { meta: { label: mod }, actions: [] });
        const usagesArr = usedKeys.get(key);
        moduleGroups.get(mod).actions.push({ key, meta, usages: usagesArr || [] });
      }
    }

    let md = `# FlowFin Permissions Coverage\n\nGenerated: ${new Date().toISOString()}\n\n`;
    md += `**Total declared keys:** ${declaredAllKeys.size}  \n`;
    md += `**Total action keys:** ${declaredActionKeys.size}  \n`;
    md += `**Used keys:** ${usedKeySet.size}  \n`;
    md += `**Missing (ERROR):** ${missing.length}  \n`;
    md += `**Orphans (WARN):** ${orphans.length}  \n\n`;
    md += `---\n\n`;

    for (const [moduleKey, group] of moduleGroups.entries()) {
      md += `## ${group.meta?.label || moduleKey} (\`${moduleKey}\`)\n\n`;
      if (group.actions.length === 0) {
        md += `_No action keys._\n\n`;
        continue;
      }
      md += `| Key | Label | Admin | Member | Used In |\n`;
      md += `|-----|-------|-------|--------|---------|\n`;
      for (const { key, meta, usages } of group.actions) {
        const adm = perm(meta.defaultAdmin);
        const mem = perm(meta.defaultMember);
        const files = usages.length ? usages.map(u => `\`${u.file}:${u.line}\``).join(', ') : '_orphan_';
        md += `| \`${key}\` | ${meta.label || ''} | ${adm} | ${mem} | ${files} |\n`;
      }
      md += '\n';
    }

    if (orphans.length > 0) {
      md += `## Orphan Keys (declared but not used)\n\n`;
      md += orphans.map(k => `- \`${k}\``).join('\n');
      md += '\n\n';
    }

    if (missing.length > 0) {
      md += `## Missing Keys (used but not declared — BUILD FAILS)\n\n`;
      for (const k of missing) {
        const usages = usedKeys.get(k) || [];
        md += `- \`${k}\` — used in: ${usages.map(u => `${u.file}:${u.line}`).join(', ')}\n`;
      }
      md += '\n';
    }

    const outPath = join(docsDir, 'permissions-coverage.md');
    await writeFile(outPath, md, 'utf8');
    console.log(`\n📄 Coverage report written to docs/permissions-coverage.md`);
  }

  if (hasErrors) {
    console.error('\n❌ Build blocked: fix missing permission keys above.\n');
    process.exit(1);
  }

  console.log('\n✅ permissions:check passed.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
