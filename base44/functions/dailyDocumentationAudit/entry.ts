import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const AUDIT_EMAIL = 'h.josepablo@gmail.com';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const STALE_MANUAL_DAYS = 60;

// These are updated manually or by the changelog script each release
const CURRENT_VERSION_IN_CODE = '1.0.0';
const USER_MANUAL_SECTIONS_COUNT = 22; // approximate count of sections in UserManual page
const USER_MANUAL_LAST_REVIEWED = '2026-05-07';

function fmtDate(d) {
  return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysSince(isoDate) {
  if (!isoDate) return null;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (24 * 60 * 60 * 1000));
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

async function generateChangelog(currentVersion) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada');

  const prompt = `Eres el asistente de desarrollo de FlowFin, una app de finanzas familiares.
Genera una entrada de changelog para la nueva versión basándote en el contexto general de la app.

## Versión actual: ${currentVersion}
## Fecha: ${todayISO()}

## Instrucciones:
1. Determina el tipo de bump: "patch" para mantenimiento, "minor" para features nuevas.
2. Genera entre 3 y 5 entradas genéricas de mantenimiento en español.
3. Empieza cada una con el módulo (ej: "Sistema:", "Fix:", "Asistente IA:").

## Responde ÚNICAMENTE con JSON válido (sin markdown):
{"bumpType":"patch","changes":["Sistema: actualización de dependencias","Fix: mejoras de estabilidad"]}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${txt.slice(0, 200)}`);
  }

  const data = await resp.json();
  const raw = data.content?.[0]?.type === 'text' ? data.content[0].text.trim() : '';
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error(`Claude no devolvió JSON válido: ${raw.slice(0, 200)}`);

  const parsed = JSON.parse(jsonMatch[1].trim());
  if (!parsed.bumpType || !Array.isArray(parsed.changes)) {
    throw new Error(`JSON incompleto: ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

function buildEmailHtml(opts) {
  const statusBadge = opts.errors.length > 0
    ? '<span style="color:#dc2626;font-weight:700">⚠️ Con errores</span>'
    : opts.action === 'updated'
      ? '<span style="color:#d97706;font-weight:700">🆕 Versión actualizada automáticamente</span>'
      : '<span style="color:#059669;font-weight:700">✅ Todo en orden</span>';

  const changesBlock = opts.changes?.length
    ? `<p><strong>Cambios registrados (v${opts.newVersion}):</strong></p>
       <ul style="margin:0;padding-left:1.2em;font-size:13px;color:#374151">
         ${opts.changes.map(c => `<li>${c}</li>`).join('')}
       </ul>`
    : '';

  const manualAge = opts.daysSinceManualReview !== null ? `${opts.daysSinceManualReview} días` : '—';
  const manualWarning = opts.daysSinceManualReview !== null && opts.daysSinceManualReview > STALE_MANUAL_DAYS
    ? `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px;color:#92400e">
        ⚠️ El manual no se ha revisado en ${opts.daysSinceManualReview} días. Revisa si hay funcionalidades sin documentar.
       </div>`
    : '';

  const errorBlock = opts.errors.length > 0
    ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px;color:#991b1b">
        <strong>Errores (${opts.errors.length}):</strong>
        <ul style="margin:4px 0 0;padding-left:1.2em">${opts.errors.map(e => `<li>${e}</li>`).join('')}</ul>
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
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:14px}
.row:last-child{border-bottom:none}
.val{font-weight:700;color:#1f2937}
.f{padding:16px 32px;background:#f8fafc;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
.f a{color:#059669}
</style></head><body><div class="w">
<div class="h"><h1>📚 FlowFin — Auditoría de Documentación</h1><p>${opts.runDate} · Ejecución automática nocturna</p></div>
<div class="b">
  <p>Estado: ${statusBadge}</p>
  <div class="g">
    <div class="row"><span>Versión en código</span><span class="val">${opts.codeVersion}</span></div>
    ${opts.action === 'updated'
      ? `<div class="row"><span>Versión anterior en BD</span><span class="val">${opts.dbVersionBefore ?? '—'}</span></div>
         <div class="row" style="border-bottom:none"><span>Nueva versión registrada</span><span class="val" style="color:#d97706">${opts.newVersion}</span></div>`
      : `<div class="row" style="border-bottom:none"><span>Estado changelog</span><span class="val">✅ Al día (v${opts.codeVersion})</span></div>`
    }
  </div>
  ${changesBlock}
  <div class="g" style="margin-top:14px">
    <div class="row"><span>Secciones en manual</span><span class="val">${opts.manualSectionsCount}</span></div>
    <div class="row" style="border-bottom:none"><span>Manual revisado hace</span><span class="val">${manualAge}</span></div>
  </div>
  ${manualWarning}
  ${errorBlock}
</div>
<div class="f">FlowFin — <strong>ACACIA Consultoría</strong> &nbsp;·&nbsp; <a href="mailto:soporte@acaciaco.com.mx">soporte@acaciaco.com.mx</a></div>
</div></body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const runDate = fmtDate(now);
    const errors = [];

    // Fetch latest AppChangelog from entity
    let latestChangelog = null;
    try {
      const rows = await base44.asServiceRole.entities.AppChangelog.list('-release_date', 1);
      latestChangelog = rows?.[0] ?? null;
    } catch (e) {
      errors.push(`AppChangelog query: ${e.message}`);
    }

    const entityVersion = latestChangelog?.version ?? null;
    const isInSync = entityVersion === CURRENT_VERSION_IN_CODE;

    let action = 'ok';
    let newVersion;
    let changes;

    if (!isInSync) {
      try {
        const result = await generateChangelog(CURRENT_VERSION_IN_CODE);
        newVersion = bumpVersion(CURRENT_VERSION_IN_CODE, result.bumpType);
        changes = result.changes;

        // Mark previous is_current=false
        try {
          const allCurrent = await base44.asServiceRole.entities.AppChangelog.filter({ is_current: true });
          for (const row of (allCurrent ?? [])) {
            if (row.id) await base44.asServiceRole.entities.AppChangelog.update(row.id, { is_current: false });
          }
        } catch (e) {
          errors.push(`Mark old is_current: ${e.message}`);
        }

        await base44.asServiceRole.entities.AppChangelog.create({
          version: newVersion,
          release_date: todayISO(),
          changes,
          is_current: true,
        });

        // Update AppVersion
        try {
          const versions = await base44.asServiceRole.entities.AppVersion.list('-created_date', 1);
          const latest = versions?.[0];
          if (latest?.id) {
            await base44.asServiceRole.entities.AppVersion.update(latest.id, { version: newVersion });
          } else {
            await base44.asServiceRole.entities.AppVersion.create({ version: newVersion });
          }
        } catch (e) {
          errors.push(`AppVersion update: ${e.message}`);
        }

        action = 'updated';
      } catch (e) {
        errors.push(`Changelog generation: ${e.message}`);
        action = 'error';
      }
    }

    const daysSinceManualReview = daysSince(USER_MANUAL_LAST_REVIEWED);

    try {
      const subjectParts = action === 'updated'
        ? `nueva v${newVersion} creada`
        : action === 'error' ? 'error al actualizar' : 'todo OK';
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: AUDIT_EMAIL,
        subject: `[FlowFin] Documentación · ${subjectParts} · ${runDate}`,
        body: buildEmailHtml({
          runDate,
          action,
          codeVersion: CURRENT_VERSION_IN_CODE,
          newVersion,
          changes,
          dbVersionBefore: entityVersion,
          daysSinceManualReview,
          manualSectionsCount: USER_MANUAL_SECTIONS_COUNT,
          errors,
        }),
        from_name: 'FlowFin Audit',
      });
    } catch (emailErr) {
      errors.push(`Email: ${emailErr.message}`);
    }

    console.log(`[dailyDocumentationAudit] codeVersion:${CURRENT_VERSION_IN_CODE} entityVersion:${entityVersion} inSync:${isInSync} action:${action} errors:${errors.length}`);
    return Response.json({ success: true, codeVersion: CURRENT_VERSION_IN_CODE, entityVersion, isInSync, action, newVersion, errors });
  } catch (err) {
    console.error(`[dailyDocumentationAudit] Fatal: ${err.message}`);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});