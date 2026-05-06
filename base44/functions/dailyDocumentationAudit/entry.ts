import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  CURRENT_VERSION_IN_CODE,
  VERSION_HISTORY_SNAPSHOT,
  USER_MANUAL_SECTIONS_COUNT,
  USER_MANUAL_LAST_REVIEWED,
} from './versionHistorySnapshot.ts';

const AUDIT_EMAIL = 'h.josepablo@gmail.com';
const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_VERSION_DAYS = 14;
const STALE_MANUAL_DAYS = 60;

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysSince(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / DAY_MS);
}

interface AuditResult {
  runDate: string;
  dbVersion: string | null;
  dbVersionUpdatedAt: string | null;
  daysSinceDbVersionBump: number | null;
  codeVersion: string;
  changelogTopVersion: string;
  changelogTopDate: string;
  versionInSync: boolean;
  daysSinceManualReview: number | null;
  manualSectionsInCode: number;
  recommendations: string[];
  errors: string[];
}

function buildEmailHtml(r: AuditResult): string {
  const allGood = r.recommendations.length === 0 && r.errors.length === 0;
  const statusBadge = r.errors.length > 0
    ? '<span style="color:#dc2626;font-weight:700">⚠️ Con errores</span>'
    : allGood
      ? '<span style="color:#059669;font-weight:700">✅ Todo en orden</span>'
      : '<span style="color:#d97706;font-weight:700">📋 Requiere atención</span>';

  const syncIcon = r.versionInSync ? '✅' : '❌';
  const manualAge = r.daysSinceManualReview !== null ? `${r.daysSinceManualReview} días` : '—';
  const dbAge = r.daysSinceDbVersionBump !== null ? `${r.daysSinceDbVersionBump} días` : '—';

  const recsBlock = r.recommendations.length === 0
    ? '<p style="color:#059669;font-weight:600">Sin pendientes — documentación al día ✅</p>'
    : `<ul style="margin:0;padding-left:1.2em;font-size:14px;color:#92400e">
        ${r.recommendations.map(rec => `<li>${rec}</li>`).join('')}
       </ul>`;

  const errorBlock = r.errors.length > 0
    ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px;color:#991b1b">
        <strong>Errores técnicos:</strong>
        <ul style="margin:4px 0 0;padding-left:1.2em">${r.errors.map(e => `<li>${e}</li>`).join('')}</ul>
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
.g{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px;color:#166534}
.y{background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px;color:#92400e}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:14px}
.row:last-child{border-bottom:none}
.val{font-weight:700;color:#1f2937}
.f{padding:16px 32px;background:#f8fafc;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
.f a{color:#059669}
</style></head><body><div class="w">
<div class="h"><h1>📚 FlowFin — Auditoría de Documentación</h1><p>${r.runDate} · Ejecución automática nocturna</p></div>
<div class="b">
  <p>Estado: ${statusBadge}</p>

  <p><strong>Versión actual</strong></p>
  <div class="g">
    <div class="row"><span>Versión en BD (AppVersion)</span><span class="val">${r.dbVersion ?? '—'}</span></div>
    <div class="row"><span>Versión en código (About.jsx)</span><span class="val">${r.codeVersion}</span></div>
    <div class="row"><span>Última entrada changelog</span><span class="val">${r.changelogTopVersion} · ${fmtDate(r.changelogTopDate)}</span></div>
    <div class="row"><span>Versiones sincronizadas</span><span class="val">${syncIcon} ${r.versionInSync ? 'Sí' : 'No'}</span></div>
    <div class="row"><span>BD actualizada hace</span><span class="val">${dbAge}</span></div>
    <div class="row" style="border-bottom:none"><span>Manual revisado hace</span><span class="val">${manualAge}</span></div>
  </div>

  <p><strong>Manual de usuario</strong></p>
  <div class="g">
    <div class="row"><span>Secciones en código</span><span class="val">${r.manualSectionsInCode}</span></div>
    <div class="row" style="border-bottom:none"><span>Última revisión registrada</span><span class="val">${fmtDate(USER_MANUAL_LAST_REVIEWED)}</span></div>
  </div>

  <p><strong>Pendientes</strong></p>
  <div class="y">${recsBlock}</div>

  ${errorBlock}
  <p style="font-size:13px;color:#6b7280;margin-top:16px">
    Para actualizar la versión en BD: usa la entidad <code>AppVersion</code> en el panel de Base44.<br>
    Para actualizar el changelog: edita <code>src/pages/About.jsx</code> (VERSION_HISTORY) y luego actualiza <code>base44/functions/dailyDocumentationAudit/versionHistorySnapshot.ts</code>.
  </p>
</div>
<div class="f">FlowFin — <strong>ACACIA Consultoría</strong> &nbsp;·&nbsp; <a href="mailto:soporte@acaciaco.com.mx">soporte@acaciaco.com.mx</a></div>
</div></body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const runDate = now.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

    const result: AuditResult = {
      runDate,
      dbVersion: null,
      dbVersionUpdatedAt: null,
      daysSinceDbVersionBump: null,
      codeVersion: CURRENT_VERSION_IN_CODE,
      changelogTopVersion: VERSION_HISTORY_SNAPSHOT[0]?.version ?? '—',
      changelogTopDate: VERSION_HISTORY_SNAPSHOT[0]?.date ?? '',
      versionInSync: false,
      daysSinceManualReview: daysSince(USER_MANUAL_LAST_REVIEWED),
      manualSectionsInCode: USER_MANUAL_SECTIONS_COUNT,
      recommendations: [],
      errors: [],
    };

    // Read AppVersion entity (most recent record)
    try {
      const versions = await base44.asServiceRole.entities.AppVersion.list('-created_date', 1);
      const latest = versions?.[0];
      if (latest) {
        result.dbVersion = latest.version ?? null;
        result.dbVersionUpdatedAt = latest.updated_date ?? latest.created_date ?? null;
        result.daysSinceDbVersionBump = daysSince(result.dbVersionUpdatedAt);
      }
    } catch (e) {
      result.errors.push(`AppVersion query: ${getErrorMessage(e)}`);
    }

    // Sync checks
    result.versionInSync =
      result.dbVersion !== null &&
      result.dbVersion === CURRENT_VERSION_IN_CODE &&
      result.dbVersion === result.changelogTopVersion;

    // Build recommendations
    if (result.dbVersion === null) {
      result.recommendations.push('No hay registro en la entidad AppVersion. Crea uno con la versión actual.');
    } else if (result.dbVersion !== CURRENT_VERSION_IN_CODE) {
      result.recommendations.push(
        `AppVersion en BD (${result.dbVersion}) ≠ versión en código (${CURRENT_VERSION_IN_CODE}). Actualiza la entidad AppVersion.`
      );
    }

    if (CURRENT_VERSION_IN_CODE !== result.changelogTopVersion) {
      result.recommendations.push(
        `La versión en código (${CURRENT_VERSION_IN_CODE}) no coincide con la primera entrada del changelog (${result.changelogTopVersion}). ` +
        `Agrega la entrada a VERSION_HISTORY en About.jsx y actualiza versionHistorySnapshot.ts.`
      );
    }

    if (result.daysSinceDbVersionBump !== null && result.daysSinceDbVersionBump > STALE_VERSION_DAYS) {
      result.recommendations.push(
        `La versión en BD no se ha actualizado en ${result.daysSinceDbVersionBump} días. ` +
        `Si hubo cambios recientes, considera lanzar una nueva versión.`
      );
    }

    if (result.daysSinceManualReview !== null && result.daysSinceManualReview > STALE_MANUAL_DAYS) {
      result.recommendations.push(
        `El manual de usuario no ha sido revisado en ${result.daysSinceManualReview} días. ` +
        `Revisa si hay funcionalidades nuevas sin documentar y actualiza USER_MANUAL_LAST_REVIEWED en versionHistorySnapshot.ts.`
      );
    }

    // Send email
    try {
      const subjectStatus = result.recommendations.length === 0 ? 'todo OK' : `${result.recommendations.length} pendiente(s)`;
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: AUDIT_EMAIL,
        subject: `[FlowFin] Auditoría de documentación · v${result.codeVersion} · ${subjectStatus} · ${runDate}`,
        body: buildEmailHtml(result),
        from_name: 'FlowFin Audit',
      });
    } catch (emailErr) {
      result.errors.push(`Email: ${getErrorMessage(emailErr)}`);
    }

    console.log(`[dailyDocumentationAudit] Done. Version: ${result.codeVersion}, inSync: ${result.versionInSync}, recs: ${result.recommendations.length}`);
    return Response.json({ success: true, ...result });
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error(`[dailyDocumentationAudit] Fatal: ${msg}`);
    return Response.json({ success: false, error: msg }, { status: 500 });
  }
});
