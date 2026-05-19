import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  CURRENT_VERSION_IN_CODE,
  GIT_LOG_SNAPSHOT,
  USER_MANUAL_LAST_REVIEWED,
  USER_MANUAL_SECTIONS_COUNT,
} from './versionHistorySnapshot.ts';

const AUDIT_EMAIL       = 'h.josepablo@gmail.com';
const MANUAL_STALE_DAYS = 60;

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

// Parse "hash message" lines from GIT_LOG_SNAPSHOT into readable descriptions
function parseGitLog(raw: string): string[] {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 8)
    .map(l => l.replace(/^[0-9a-f]{7,}\s+/, '').trim())
    .filter(Boolean);
}

// ── Email builder ─────────────────────────────────────────────────────────────

type CheckResult = { label: string; status: '✅' | '🔧' | '⚠️'; detail: string };

function buildEmailHtml(opts: {
  runDate: string;
  codeVersion: string;
  checks: CheckResult[];
  manualActions: string[];
}): string {
  const hasWarning = opts.checks.some(c => c.status === '⚠️');
  const hasFix     = opts.checks.some(c => c.status === '🔧');
  const allOk      = !hasWarning && !hasFix;

  const overallBadge = opts.checks.some(c => c.status === '⚠️')
    ? '<span style="color:#dc2626;font-weight:700">⚠️ Atención requerida</span>'
    : hasFix
      ? '<span style="color:#d97706;font-weight:700">🔧 Correcciones aplicadas</span>'
      : '<span style="color:#059669;font-weight:700">✅ Todo sincronizado</span>';

  const checksHtml = opts.checks.map(c => `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px">
      <span style="font-size:16px;line-height:1">${c.status}</span>
      <div><strong>${c.label}</strong>${c.detail ? `<br><span style="color:#6b7280">${c.detail}</span>` : ''}</div>
    </div>`).join('');

  const manualHtml = opts.manualActions.length > 0
    ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px;color:#92400e">
        <strong>Acciones manuales pendientes:</strong>
        <ul style="margin:6px 0 0;padding-left:1.2em">${opts.manualActions.map(a => `<li>${a}</li>`).join('')}</ul>
       </div>`
    : '';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,sans-serif;background:#f1f5f9;margin:0;padding:16px}
.w{max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.h{background:linear-gradient(135deg,#059669,#047857);padding:24px 32px;color:#fff}
.h h1{margin:0;font-size:18px;font-weight:700}
.h p{margin:4px 0 0;color:#a7f3d0;font-size:12px}
.b{padding:24px 32px;color:#374151;line-height:1.7;font-size:15px}
.b p{margin:0 0 12px}
.f{padding:16px 32px;background:#f8fafc;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
.f a{color:#059669}
</style></head><body><div class="w">
<div class="h">
  <h1>📚 FlowFin — Auditoría de Documentación</h1>
  <p>${opts.runDate} · v${opts.codeVersion} · Ejecución automática nocturna</p>
</div>
<div class="b">
  <p>Estado general: ${overallBadge}</p>
  <div style="margin:14px 0">${checksHtml}</div>
  ${manualHtml}
</div>
<div class="f">FlowFin — <strong>ACACIA Consultoría</strong> &nbsp;·&nbsp; <a href="mailto:soporte@acaciaco.com.mx">soporte@acaciaco.com.mx</a></div>
</div></body></html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  let failureStage = 'init';
  try {
    const base44    = createClientFromRequest(req);
    const runDate   = fmtDate(new Date());
    const checks: CheckResult[]  = [];
    const manualActions: string[] = [];

    // ── Check 1: DB version in sync with code ──────────────────────────────
    failureStage = 'version_sync';
    const appVersionRows  = await base44.asServiceRole.entities.AppVersion.list('-created_date', 1);
    const appVersionRecord = appVersionRows?.[0] ?? null;
    const dbVersion: string = appVersionRecord?.version ?? '';

    if (!dbVersion) {
      await base44.asServiceRole.entities.AppVersion.create({ version: CURRENT_VERSION_IN_CODE });
      checks.push({
        label: 'Versión en base de datos',
        status: '🔧',
        detail: `No había registro — creado con v${CURRENT_VERSION_IN_CODE} (código)`,
      });
    } else if (dbVersion !== CURRENT_VERSION_IN_CODE) {
      if (appVersionRecord?.id) {
        await base44.asServiceRole.entities.AppVersion.update(appVersionRecord.id, { version: CURRENT_VERSION_IN_CODE });
      }
      checks.push({
        label: 'Versión en base de datos',
        status: '🔧',
        detail: `DB tenía v${dbVersion}, corregido a v${CURRENT_VERSION_IN_CODE} (fuente: código)`,
      });
    } else {
      checks.push({
        label: 'Versión en base de datos',
        status: '✅',
        detail: `v${CURRENT_VERSION_IN_CODE} — código y DB coinciden`,
      });
    }

    // ── Check 2: Changelog coverage for current version ────────────────────
    failureStage = 'changelog_coverage';
    const commitLines = parseGitLog(GIT_LOG_SNAPSHOT);
    const existingChangelogs = await base44.asServiceRole.entities.AppChangelog.filter({
      version: CURRENT_VERSION_IN_CODE,
    }) ?? [];
    const currentChangelog = existingChangelogs[0] ?? null;
    const changelogHasEntries = Array.isArray(currentChangelog?.changes) && currentChangelog.changes.length > 0;

    // Track the live DB state of the changelog as Check 2 repairs it, so Check 3 merges
    // drafts against the real post-repair content rather than the stale pre-fetch snapshot.
    let liveChangelogId: string | null = currentChangelog?.id ?? null;
    let liveChanges: string[] = Array.isArray(currentChangelog?.changes) ? [...currentChangelog.changes] : [];

    if (!currentChangelog) {
      if (commitLines.length > 0) {
        // Changelog missing entirely — create it from git log so it's documented
        const created = await base44.asServiceRole.entities.AppChangelog.create({
          version: CURRENT_VERSION_IN_CODE,
          release_date: todayISO(),
          changes: commitLines,
          is_current: true,
        });
        liveChangelogId = created?.id ?? null;
        liveChanges = [...commitLines];
        checks.push({
          label: `Changelog v${CURRENT_VERSION_IN_CODE}`,
          status: '🔧',
          detail: `No existía entrada — creada con ${commitLines.length} commits del git log`,
        });
      } else {
        checks.push({
          label: `Changelog v${CURRENT_VERSION_IN_CODE}`,
          status: '⚠️',
          detail: 'No hay changelog ni commits en el snapshot — actualiza About.jsx y ejecuta npm run build',
        });
        manualActions.push(`Agregar entradas al changelog de v${CURRENT_VERSION_IN_CODE} en About.jsx`);
      }
    } else if (!changelogHasEntries && commitLines.length > 0) {
      // Changelog exists but is empty — populate from git log
      await base44.asServiceRole.entities.AppChangelog.update(currentChangelog.id, {
        changes: commitLines,
      });
      liveChanges = [...commitLines];
      checks.push({
        label: `Changelog v${CURRENT_VERSION_IN_CODE}`,
        status: '🔧',
        detail: `Entrada existía pero vacía — poblada con ${commitLines.length} commits del git log`,
      });
    } else {
      checks.push({
        label: `Changelog v${CURRENT_VERSION_IN_CODE}`,
        status: '✅',
        detail: `${(currentChangelog?.changes ?? []).length} entradas documentadas`,
      });
    }

    // ── Check 3: Unpublished ChangelogDraft records ────────────────────────
    failureStage = 'changelog_drafts';
    let drafts: Array<{ id?: string; type: string; description: string }> = [];
    try {
      drafts = await base44.asServiceRole.entities.ChangelogDraft.filter({ is_published: false }) ?? [];
    } catch (_) {
      // table may not exist yet
    }

    if (drafts.length > 0) {
      // Merge drafts into liveChanges (which reflects any repairs made by Check 2 this same run)
      const draftStrings = drafts.map(d => `${d.type}: ${d.description}`);
      const mergedChanges = [...new Set([...liveChanges, ...draftStrings])];

      if (liveChangelogId) {
        await base44.asServiceRole.entities.AppChangelog.update(liveChangelogId, {
          changes: mergedChanges,
        });
      }

      const publishedAt = new Date().toISOString();
      for (const draft of drafts) {
        if (draft.id) {
          await base44.asServiceRole.entities.ChangelogDraft.update(draft.id, {
            is_published: true,
            published_at: publishedAt,
            published_in_version: CURRENT_VERSION_IN_CODE,
          });
        }
      }

      checks.push({
        label: 'Drafts de changelog pendientes',
        status: '🔧',
        detail: `${drafts.length} draft(s) publicados en v${CURRENT_VERSION_IN_CODE}`,
      });
    } else {
      checks.push({
        label: 'Drafts de changelog pendientes',
        status: '✅',
        detail: 'Sin drafts sin publicar',
      });
    }

    // ── Check 4: User manual staleness ────────────────────────────────────
    failureStage = 'manual_staleness';
    const staleDays = daysSince(USER_MANUAL_LAST_REVIEWED);
    if (staleDays > MANUAL_STALE_DAYS) {
      checks.push({
        label: 'Manual de usuario',
        status: '⚠️',
        detail: `Última revisión hace ${staleDays} días (${USER_MANUAL_LAST_REVIEWED}) — límite: ${MANUAL_STALE_DAYS} días`,
      });
      manualActions.push(
        `Revisar UserManual.jsx (sin actualizar hace ${staleDays} días) y actualizar USER_MANUAL_LAST_REVIEWED en versionHistorySnapshot.ts`,
      );
    } else {
      checks.push({
        label: 'Manual de usuario',
        status: '✅',
        detail: `Revisado hace ${staleDays} días (${USER_MANUAL_LAST_REVIEWED}) · ${USER_MANUAL_SECTIONS_COUNT} secciones`,
      });
    }

    // ── Send audit email ───────────────────────────────────────────────────
    failureStage = 'send_email';
    const hasWarning  = checks.some(c => c.status === '⚠️');
    const hasAnyFix   = checks.some(c => c.status === '🔧');
    const statusLabel = hasWarning
      ? 'atención requerida'
      : hasAnyFix
        ? 'correcciones aplicadas'
        : 'todo sincronizado';

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: AUDIT_EMAIL,
        subject: `[FlowFin] Documentación · v${CURRENT_VERSION_IN_CODE} · ${statusLabel} · ${runDate}`,
        body: buildEmailHtml({ runDate, codeVersion: CURRENT_VERSION_IN_CODE, checks, manualActions }),
        from_name: 'FlowFin Audit',
      });
    } catch (sendErr) {
      const message = (sendErr instanceof Error) ? sendErr.message : String(sendErr);
      console.error('[dailyDocumentationAudit] SendEmail failed', { message });
      try {
        await base44.asServiceRole.entities.EmailNotification.create({
          email_type: 'daily_documentation_audit',
          recipient_email: AUDIT_EMAIL,
          status: 'pending',
          retry_count: 0,
        });
      } catch (_) { /* non-fatal */ }
      return Response.json({ success: false, stage: 'send_email', error: message }, { status: 500 });
    }

    console.log(
      `[dailyDocumentationAudit] v${CURRENT_VERSION_IN_CODE} | checks:${checks.length} fixes:${checks.filter(c => c.status === '🔧').length} warnings:${checks.filter(c => c.status === '⚠️').length}`,
    );

    return Response.json({
      success: true,
      codeVersion: CURRENT_VERSION_IN_CODE,
      checks: checks.map(c => ({ label: c.label, status: c.status })),
      manualActions,
    });

  } catch (err) {
    const message = (err instanceof Error) ? err.message : String(err);
    console.error('[dailyDocumentationAudit] Fatal error', { stage: failureStage, message });
    return Response.json({ success: false, stage: failureStage, error: message }, { status: 500 });
  }
});
