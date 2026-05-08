#!/usr/bin/env node
/**
 * update-changelog.mjs
 *
 * Usa la API de Claude para analizar los últimos commits de git,
 * determinar el tipo de cambio (patch / minor), generar las entradas
 * del changelog y actualizar automáticamente:
 *   - src/pages/About.jsx  (CURRENT_VERSION + VERSION_HISTORY)
 *
 * Uso:
 *   node scripts/update-changelog.mjs             # auto-detecta cambios
 *   node scripts/update-changelog.mjs --dry-run   # solo muestra la propuesta, no escribe
 *   node scripts/update-changelog.mjs --minor     # fuerza bump menor (2.16 → 2.17)
 *   node scripts/update-changelog.mjs --patch     # fuerza bump de parche (2.16.0 → 2.16.1)
 *
 * Requiere: ANTHROPIC_API_KEY en el entorno
 */

import Anthropic from '@anthropic-ai/sdk';
import process from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, '..');
const ABOUT_PATH = join(ROOT, 'src', 'pages', 'About.jsx');

const DRY_RUN    = process.argv.includes('--dry-run');
const FORCE_MINOR = process.argv.includes('--minor');
const FORCE_PATCH = process.argv.includes('--patch');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Parse current version from About.jsx
// ---------------------------------------------------------------------------
function getCurrentVersion(src) {
  // First entry of VERSION_HISTORY is the current version
  const m = src.match(/version:\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('No se encontró ninguna versión en VERSION_HISTORY en About.jsx');
  return m[1];
}

// ---------------------------------------------------------------------------
// Get git diff since the last tag or since HEAD~N
// ---------------------------------------------------------------------------
function getGitContext(currentVersion) {
  // Try to find the tag matching current version
  const tagExists = run(`git tag -l "v${currentVersion}"`);
  const baseRef   = tagExists ? `v${currentVersion}` : 'HEAD~20';

  const log  = run(`git log ${baseRef}..HEAD --oneline --no-merges`);
  const diff = run(`git diff ${baseRef}..HEAD --stat`);
  const files = run(`git diff ${baseRef}..HEAD --name-only`);

  // If no commits found, fall back to recent commits
  if (!log) {
    return {
      log:   run('git log HEAD~10..HEAD --oneline --no-merges'),
      diff:  run('git diff HEAD~10..HEAD --stat'),
      files: run('git diff HEAD~10..HEAD --name-only'),
    };
  }

  return { log, diff, files };
}

// ---------------------------------------------------------------------------
// Call Claude to generate the new changelog entry
// ---------------------------------------------------------------------------
async function generateChangelogEntry(currentVersion, gitContext, existingEntries) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Falta ANTHROPIC_API_KEY. Agrégala a tu entorno:\n  export ANTHROPIC_API_KEY=sk-ant-...'
    );
  }

  const client = new Anthropic({ apiKey });

  const prompt = `Eres el asistente de desarrollo de FlowFin, una app de finanzas familiares.
Analiza los cambios de git a continuación y genera una entrada de changelog para la nueva versión.

## Versión actual: ${currentVersion}

## Commits recientes (desde v${currentVersion}):
${gitContext.log || '(sin commits nuevos detectados)'}

## Archivos modificados:
${gitContext.files || '(ninguno)'}

## Resumen de cambios (git diff --stat):
${gitContext.diff || '(ninguno)'}

## Estilo de las últimas entradas del changelog (para mantener consistencia):
${existingEntries}

## Instrucciones:
1. Determina el tipo de bump de versión:
   - "patch" si son solo correcciones de bugs, mejoras menores o cambios de infraestructura
   - "minor" si hay nuevas funcionalidades visibles para el usuario
   - "major" si hay cambios que rompen la app (muy raro)
2. Genera entre 3 y 10 entradas de changelog en español, siguiendo el mismo estilo que las entradas existentes.
   - Sé específico y técnico, como en los ejemplos
   - Agrupa cambios relacionados cuando tiene sentido
   - Empieza cada entrada con el módulo afectado seguido de dos puntos (ej: "Dashboard:", "Asistente IA:", "Fix:")
3. NO incluyas cambios puramente internos de scripts de build/automatización a menos que sean relevantes para el usuario.

## Responde ÚNICAMENTE con JSON válido en este formato exacto:
{
  "bumpType": "patch" | "minor" | "major",
  "changes": [
    "Módulo: descripción del cambio 1",
    "Módulo: descripción del cambio 2"
  ]
}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';

  // Extract JSON (handles markdown code blocks)
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error(`Claude no devolvió JSON válido:\n${raw}`);

  const parsed = JSON.parse(jsonMatch[1].trim());
  if (!parsed.bumpType || !Array.isArray(parsed.changes)) {
    throw new Error(`JSON incompleto de Claude: ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Update About.jsx in-place
// ---------------------------------------------------------------------------
function updateAboutJsx(src, newVersion, changes) {
  const today   = todayISO();
  const changesJs = changes.map(c => `      '${c.replace(/'/g, "\\'")}',`).join('\n');

  const newEntry = `  {
    version: '${newVersion}',
    date: '${today}',
    label: 'Actual',
    changes: [
${changesJs}
    ],
  },`;

  // Replace CURRENT_VERSION
  let updated = src.replace(
    /const\s+CURRENT_VERSION\s*=\s*['"][^'"]+['"]/,
    `const CURRENT_VERSION = '${newVersion}'`
  );

  // Remove 'Actual' label from the previous latest entry
  updated = updated.replace(/label:\s*'Actual'/, "label: ''");

  // Insert new entry at the top of VERSION_HISTORY array
  updated = updated.replace(
    /const VERSION_HISTORY\s*=\s*\[/,
    `const VERSION_HISTORY = [\n${newEntry}`
  );

  return updated;
}

// ---------------------------------------------------------------------------
// Extract recent changelog entries for style reference
// ---------------------------------------------------------------------------
function extractExistingEntries(src) {
  const historyMatch = src.match(/const VERSION_HISTORY\s*=\s*\[([\s\S]*?)^\];/m);
  if (!historyMatch) return '(no se pudo leer)';
  // Return first ~30 lines of the array for style context
  return historyMatch[1].split('\n').slice(0, 30).join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🤖 FlowFin auto-changelog — analizando cambios con Claude...\n');

  const src = await readFile(ABOUT_PATH, 'utf8');
  const currentVersion = await getCurrentVersion(src);
  const existingEntries = extractExistingEntries(src);
  const gitContext = getGitContext(currentVersion);

  if (!gitContext.log) {
    console.log('ℹ  No se encontraron commits nuevos desde la última versión. Nada que actualizar.');
    return;
  }

  console.log(`📌 Versión actual: ${currentVersion}`);
  console.log(`📋 Commits encontrados:\n${gitContext.log}\n`);

  let bumpType, changes;
  try {
    const result = await generateChangelogEntry(currentVersion, gitContext, existingEntries);
    bumpType = FORCE_MINOR ? 'minor' : FORCE_PATCH ? 'patch' : result.bumpType;
    changes  = result.changes;
  } catch (err) {
    console.error('❌ Error al llamar a Claude:', err.message);
    process.exit(1);
  }

  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`\n✨ Propuesta de Claude:`);
  console.log(`   Versión: ${currentVersion} → ${newVersion} (${bumpType})`);
  console.log(`   Changelog:`);
  changes.forEach(c => console.log(`   • ${c}`));

  if (DRY_RUN) {
    console.log('\n🔍 Modo --dry-run activo. No se escribió ningún archivo.');
    return;
  }

  const updatedSrc = await updateAboutJsx(src, newVersion, changes);
  await writeFile(ABOUT_PATH, updatedSrc, 'utf8');

  console.log(`\n✅ About.jsx actualizado con v${newVersion}.`);
  console.log('   Ejecuta npm run build para sincronizar los snapshots.');
}

main().catch(err => {
  console.error('update-changelog failed:', err.message);
  process.exit(1);
});
