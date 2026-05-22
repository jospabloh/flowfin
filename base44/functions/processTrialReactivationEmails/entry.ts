import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { guardInternal } from '../_internalGuard.ts';

/**
 * processTrialReactivationEmails — Daily scheduled job.
 *
 * Sends a friendly "we miss you" reactivation email to trial users
 * who have been inactive for at least INACTIVITY_HOURS hours.
 *
 * Anti-spam rules:
 * - Family must be in billing_status = 'trial'
 * - trial_end_at must be in the future (days_left > 0)
 * - User must not have been active in the last INACTIVITY_HOURS hours
 * - Minimum MIN_HOURS_BETWEEN_EMAILS hours since last reactivation email
 * - Maximum MAX_EMAILS_PER_TRIAL emails per trial period
 * - Idempotency: EmailNotification dedup by notification_key
 *
 * Localization: uses familyConfig.locale to choose es/en template.
 * Falls back to 'es-MX' (Spanish) if not set.
 */

// ── Configuration ────────────────────────────────────────────────────────────
const TRIAL_REACTIVATION_ENABLED = true;
const INACTIVITY_HOURS = 24;               // send if inactive >= 24h
const MIN_HOURS_BETWEEN_EMAILS = 48;       // min gap between reactivation emails
const MAX_EMAILS_PER_TRIAL = 3;            // max reactivation emails per trial
const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.flowfin.app';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS  = 24 * HOUR_MS;

function getErrorMessage(e) {
  return e instanceof Error ? e.message : String(e);
}

function daysLeftCalc(trialEndAt) {
  return Math.max(0, Math.ceil((new Date(trialEndAt).getTime() - Date.now()) / DAY_MS));
}

function hoursSince(isoString) {
  if (!isoString) return Infinity;
  return (Date.now() - new Date(isoString).getTime()) / HOUR_MS;
}

// ── Localized templates ───────────────────────────────────────────────────────
function getTemplate(locale, { user_name, days_left, app_url }) {
  const isSpanish = !locale || locale.startsWith('es');
  const name = user_name || (isSpanish ? 'Usuario' : 'there');

  if (isSpanish) {
    return {
      subject: `Te extrañamos en FlowFin — aún tienes ${days_left} día${days_left === 1 ? '' : 's'} de prueba`,
      html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;margin:0;padding:16px}
  .wrap{max-width:560px;margin:0 auto}
  .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .hdr{background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px 32px}
  .hdr h1{color:#fff;font-size:18px;margin:0;font-weight:700}
  .hdr p{color:#a7f3d0;font-size:12px;margin:4px 0 0}
  .body{padding:28px 32px;color:#374151;line-height:1.7;font-size:15px}
  .body p{margin:0 0 14px}
  .body ul{margin:0 0 14px;padding-left:22px}
  .body li{margin-bottom:5px}
  .hi{color:#059669;font-weight:600}
  .cta{display:inline-block;padding:13px 28px;background:#059669;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px}
  .footer{padding:18px 32px;background:#f8fafc;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
  .footer a{color:#059669}
</style>
</head>
<body>
<div class="wrap"><div class="card">
  <div class="hdr">
    <h1>FlowFin</h1>
    <p>Finanzas familiares inteligentes · ACACIA</p>
  </div>
  <div class="body">
    <p>Hola <span class="hi">${name}</span>,</p>
    <p>Vimos que no has usado FlowFin en los últimos días y queríamos recordarte que tu prueba gratuita <strong>sigue activa</strong>.</p>
    <p>Aún te quedan <span class="hi">${days_left} día${days_left === 1 ? '' : 's'}</span> para probar todas las funcionalidades de FlowFin:</p>
    <ul>
      <li>Registrar ingresos y gastos</li>
      <li>Ver tu balance familiar</li>
      <li>Organizar tus categorías</li>
      <li>Usar el asistente para capturar movimientos</li>
      <li>Revisar tus finanzas con más claridad</li>
    </ul>
    <p>Tu trial de 30 días está pensado para que puedas explorar FlowFin con calma y decidir si realmente te ayuda.</p>
    <p>Puedes volver cuando quieras:</p>
    <div style="margin:20px 0"><a href="${app_url}" class="cta">Volver a FlowFin →</a></div>
    <p>Equipo FlowFin</p>
  </div>
  <div class="footer">
    FlowFin — <strong>ACACIA Consultoría</strong><br>
    ¿Dudas? <a href="mailto:soporte@acaciaco.com.mx">soporte@acaciaco.com.mx</a>
  </div>
</div></div>
</body></html>`,
    };
  }

  // English fallback
  return {
    subject: `We miss you in FlowFin — you still have ${days_left} trial day${days_left === 1 ? '' : 's'} left`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;margin:0;padding:16px}
  .wrap{max-width:560px;margin:0 auto}
  .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .hdr{background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px 32px}
  .hdr h1{color:#fff;font-size:18px;margin:0;font-weight:700}
  .hdr p{color:#a7f3d0;font-size:12px;margin:4px 0 0}
  .body{padding:28px 32px;color:#374151;line-height:1.7;font-size:15px}
  .body p{margin:0 0 14px}
  .body ul{margin:0 0 14px;padding-left:22px}
  .body li{margin-bottom:5px}
  .hi{color:#059669;font-weight:600}
  .cta{display:inline-block;padding:13px 28px;background:#059669;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px}
  .footer{padding:18px 32px;background:#f8fafc;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
  .footer a{color:#059669}
</style>
</head>
<body>
<div class="wrap"><div class="card">
  <div class="hdr">
    <h1>FlowFin</h1>
    <p>Smart Family Finances · ACACIA</p>
  </div>
  <div class="body">
    <p>Hi <span class="hi">${name}</span>,</p>
    <p>We noticed you have not used FlowFin in the last few days. Your free trial is <strong>still active</strong>.</p>
    <p>You still have <span class="hi">${days_left} day${days_left === 1 ? '' : 's'}</span> to explore all FlowFin features:</p>
    <ul>
      <li>Register income and expenses</li>
      <li>Review your family balance</li>
      <li>Organize your categories</li>
      <li>Use the assistant to capture movements</li>
      <li>Understand your finances more clearly</li>
    </ul>
    <p>Your 30-day trial is designed so you can explore FlowFin calmly and decide if it really helps you.</p>
    <p>Come back here:</p>
    <div style="margin:20px 0"><a href="${app_url}" class="cta">Return to FlowFin →</a></div>
    <p>The FlowFin Team</p>
  </div>
  <div class="footer">
    FlowFin — <strong>ACACIA Consultoría</strong><br>
    Questions? <a href="mailto:soporte@acaciaco.com.mx">soporte@acaciaco.com.mx</a>
  </div>
</div></div>
</body></html>`,
  };
}

// ── Send via Base44 Core.SendEmail ────────────────────────────────────────────
async function sendEmail(base44, to, subject, html) {
  await base44.asServiceRole.integrations.Core.SendEmail({
    to,
    subject,
    body: html,
    from_name: 'FlowFin',
  });
}

// ── Idempotency check via EmailNotification ───────────────────────────────────
function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function isAlreadySent(base44, notification_key) {
  const existing = await base44.asServiceRole.entities.EmailNotification.filter({ notification_key });
  return existing.some(e => e.status === 'sent' || e.status === 'pending');
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (!TRIAL_REACTIVATION_ENABLED) {
    return Response.json({ success: true, skipped: true, reason: 'feature_disabled' });
  }

  try {
    const base44 = createClientFromRequest(req);
    const denied = await guardInternal(base44, req);
    if (denied) return denied;
    const nowISO = new Date().toISOString();

    const stats = {
      scanned: 0,
      eligible: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      skip_reasons: {},
    };

    const skip = (reason) => {
      stats.skipped++;
      stats.skip_reasons[reason] = (stats.skip_reasons[reason] || 0) + 1;
    };

    console.log('[processTrialReactivationEmails] started', nowISO);

    // ── 1. Load all active trial families ───────────────────────────────────
    const trialFamilies = await base44.asServiceRole.entities.Family.filter({ billing_status: 'trial' });

    for (const family of trialFamilies) {
      if (!family.trial_end_at) { skip('no_trial_end_at'); continue; }

      const daysLeft = daysLeftCalc(family.trial_end_at);
      if (daysLeft <= 0) { skip('trial_expired'); continue; }

      // ── 2. Get all approved members of this family ─────────────────────────
      let memberships = [];
      try {
        memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
          family_id: family.id,
          status: 'approved',
        });
      } catch (err) {
        stats.failed++;
        console.error(`[processTrialReactivationEmails] membership fetch error family ${family.id}:`, getErrorMessage(err));
        continue;
      }

      // Load familyConfig for locale
      let locale = 'es-MX';
      try {
        const configs = await base44.asServiceRole.entities.FamilyConfig.filter({ family_id: family.id });
        if (configs[0]?.locale) locale = configs[0].locale;
      } catch { /* ignore, fallback to es-MX */ }

      for (const membership of memberships) {
        stats.scanned++;

        const email = membership.user_email;
        if (!email || !email.includes('@')) { skip('no_valid_email'); continue; }

        // Anti-spam: inactivity check
        const inactiveHours = hoursSince(membership.last_active_at);
        if (inactiveHours < INACTIVITY_HOURS) { skip('user_active_recently'); continue; }

        // Anti-spam: min hours between reactivation emails
        const hoursSinceLast = hoursSince(membership.last_trial_reactivation_email_at);
        if (hoursSinceLast < MIN_HOURS_BETWEEN_EMAILS) { skip('too_soon_since_last_email'); continue; }

        // Anti-spam: max emails per trial
        const emailCount = membership.trial_reactivation_email_count || 0;
        if (emailCount >= MAX_EMAILS_PER_TRIAL) { skip('max_emails_reached'); continue; }

        // Idempotency key: membership:date so job can run twice safely
        const notification_key = `trial_reactivation:${membership.id}:${todayKey()}`;
        const alreadySent = await isAlreadySent(base44, notification_key);
        if (alreadySent) { skip('already_sent_today'); continue; }

        stats.eligible++;

        // Build template
        const userName = membership.user_name || email.split('@')[0];
        const template = getTemplate(locale, { user_name: userName, days_left: daysLeft, app_url: APP_URL });

        // Create pending EmailNotification for dedup tracking
        try {
          await base44.asServiceRole.entities.EmailNotification.create({
            family_id: family.id,
            email_type: 'trial_reactivation',
            recipient_email: email,
            status: 'pending',
            retry_count: 0,
            notification_key,
            scheduled_for: nowISO,
            metadata: {
              user_id: membership.user_id,
              membership_id: membership.id,
              days_left: daysLeft,
              locale,
              family_name: family.name,
            },
          });
        } catch (err) {
          stats.failed++;
          console.error(`[processTrialReactivationEmails] EmailNotification create failed for ${email}:`, getErrorMessage(err));
          continue;
        }

        // Send email
        try {
          await sendEmail(base44, email, template.subject, template.html);

          // Mark sent in EmailNotification
          try {
            const notifs = await base44.asServiceRole.entities.EmailNotification.filter({ notification_key });
            if (notifs[0]) {
              await base44.asServiceRole.entities.EmailNotification.update(notifs[0].id, {
                status: 'sent',
                sent_at: new Date().toISOString(),
                last_attempt_at: new Date().toISOString(),
              });
            }
          } catch { /* non-fatal */ }

          // Update membership counters ONLY after successful send
          await base44.asServiceRole.entities.FamilyMembership.update(membership.id, {
            last_trial_reactivation_email_at: new Date().toISOString(),
            trial_reactivation_email_count: emailCount + 1,
          });

          stats.sent++;
          console.log(`[processTrialReactivationEmails] sent to ${email} (family: ${family.id}, daysLeft: ${daysLeft})`);
        } catch (err) {
          const errMsg = getErrorMessage(err);
          stats.failed++;

          // Update EmailNotification to failed (don't update membership counters)
          try {
            const notifs = await base44.asServiceRole.entities.EmailNotification.filter({ notification_key });
            if (notifs[0]) {
              await base44.asServiceRole.entities.EmailNotification.update(notifs[0].id, {
                status: 'failed',
                retry_count: 1,
                last_attempt_at: new Date().toISOString(),
                error_message: errMsg,
              });
            }
          } catch { /* non-fatal */ }

          console.error(`[processTrialReactivationEmails] send failed for ${email}:`, errMsg);
        }
      }
    }

    const summary = {
      success: true,
      ...stats,
      timestamp: nowISO,
    };
    console.log('[processTrialReactivationEmails] completed', JSON.stringify(summary));
    return Response.json(summary);
  } catch (error) {
    const msg = getErrorMessage(error);
    console.error('[processTrialReactivationEmails] Fatal error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
});