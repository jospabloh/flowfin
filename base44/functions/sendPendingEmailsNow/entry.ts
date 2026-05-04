import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Función temporal para enviar correos pending usando Base44 Core.SendEmail directamente
// Sin dependencia de Resend

const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.flowfin.app';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatYYYYMM(period) {
  if (!period) return '—';
  const [y, m] = period.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

function wrap(content) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
  body{font-family:-apple-system,sans-serif;background:#f1f5f9;margin:0;padding:16px}
  .wrap{max-width:560px;margin:0 auto}
  .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .hdr{background:linear-gradient(135deg,#059669,#047857);padding:28px 32px;color:#fff}
  .hdr h1{margin:0;font-size:18px;font-weight:700}
  .hdr p{margin:4px 0 0;color:#a7f3d0;font-size:12px}
  .body{padding:28px 32px;color:#374151;line-height:1.7;font-size:15px}
  .body p{margin:0 0 14px}
  .hi{color:#059669;font-weight:600}
  .info-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin:16px 0;font-size:13px;color:#166534}
  .cta{display:inline-block;padding:13px 28px;background:#059669;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin:20px 0}
  .footer{padding:18px 32px;background:#f8fafc;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
  .footer a{color:#059669}
  </style></head><body><div class="wrap"><div class="card">
  <div class="hdr"><h1>🌿 FlowFin</h1><p>Finanzas familiares inteligentes · ACACIA</p></div>
  <div class="body">${content}</div>
  <div class="footer">FlowFin — <strong>ACACIA Consultoría</strong><br>
  <a href="mailto:soporte@acaciaco.com.mx">soporte@acaciaco.com.mx</a> · <a href="https://wa.me/524498958291">WhatsApp</a></div>
  </div></div></body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nowISO = new Date().toISOString();
    const results = [];

    // Get all pending notifications
    const pending = await base44.asServiceRole.entities.EmailNotification.filter({ status: 'pending' });
    console.log(`[sendPendingEmailsNow] Found ${pending.length} pending notifications`);

    for (const n of pending) {
      // Build context
      let ctx = {};
      if (n.metadata && typeof n.metadata === 'object') ctx = { ...n.metadata };

      try {
        const families = await base44.asServiceRole.entities.Family.filter({ id: n.family_id });
        if (families[0]) {
          const f = families[0];
          ctx = {
            family_name: f.name,
            trial_end_at: f.trial_end_at,
            license_expires_at: ctx.license_expires_at || f.license_expires_at,
            plan_name: ctx.plan_name || (f.license_plan === 'family_plus' ? 'FlowFin Family+' : 'FlowFin Home'),
            billing_period: ctx.billing_period || n.billing_period,
            user_name: ctx.user_name || null,
          };
        }
      } catch { /* non-fatal */ }

      // Build subject and body per type
      const name = ctx.family_name || 'tu familia';
      const userName = ctx.user_name ? `Hola ${ctx.user_name}` : 'Hola';
      const planName = ctx.plan_name || 'FlowFin Home';
      const licenseExpires = ctx.license_expires_at ? formatDate(ctx.license_expires_at) : '—';
      const billingPeriod = ctx.billing_period ? formatYYYYMM(ctx.billing_period) : '—';
      const trialEnd = formatDate(ctx.trial_end_at);

      let subject = '';
      let bodyHtml = '';

      if (n.email_type === 'payment_confirmed') {
        subject = 'Pago confirmado — tu licencia FlowFin continúa activa';
        bodyHtml = wrap(`<p>${userName}!</p>
<p>ACACIA ha confirmado tu pago del período <span class="hi">${billingPeriod}</span> para la familia <span class="hi">${name}</span>.</p>
<div class="info-box">✅ Tu plan <strong>${planName}</strong> continúa activo.<br>Tu próxima fecha de vencimiento es el <strong>${licenseExpires}</strong>.</div>
<p>Gracias por continuar con FlowFin.</p>
<a href="${APP_URL}" class="cta">Ir a FlowFin →</a>`);
      } else if (n.email_type === 'trial_welcome') {
        subject = '¡Bienvenido a FlowFin! Tu prueba gratuita de 30 días comienza hoy';
        bodyHtml = wrap(`<p>${userName}!</p>
<p>La familia <span class="hi">${name}</span> ya tiene acceso completo a FlowFin durante los próximos <span class="hi">30 días</span>, completamente gratis.</p>
<div class="info-box">✅ Registra gastos, visualiza reportes, coordina pagos y más.<br>Tu prueba termina el <strong>${trialEnd}</strong>.</div>
<a href="${APP_URL}" class="cta">Empezar ahora →</a>`);
      } else if (n.email_type === 'license_activated_welcome') {
        subject = '¡Bienvenido a FlowFin! Tu plan ya está activo';
        bodyHtml = wrap(`<p>${userName}!</p>
<p>Tu familia <span class="hi">${name}</span> ya tiene activo el plan <span class="hi">${planName}</span> en FlowFin. Gracias por confiar en ACACIA. 🎉</p>
<a href="${APP_URL}" class="cta">Entrar a FlowFin →</a>`);
      } else {
        // Skip unknown types
        results.push({ id: n.id, type: n.email_type, status: 'skipped_unknown_type' });
        continue;
      }

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: n.recipient_email,
          subject,
          body: bodyHtml,
          from_name: 'FlowFin',
        });
        await base44.asServiceRole.entities.EmailNotification.update(n.id, {
          status: 'sent',
          sent_at: nowISO,
          last_attempt_at: nowISO,
          error_message: null,
        });
        console.log(`[sendPendingEmailsNow] Sent ${n.email_type} to ${n.recipient_email}`);
        results.push({ id: n.id, type: n.email_type, to: n.recipient_email, status: 'sent' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await base44.asServiceRole.entities.EmailNotification.update(n.id, {
          status: 'failed',
          retry_count: (n.retry_count ?? 0) + 1,
          last_attempt_at: nowISO,
          error_message: msg,
        });
        console.error(`[sendPendingEmailsNow] Failed ${n.email_type}:`, msg);
        results.push({ id: n.id, type: n.email_type, to: n.recipient_email, status: 'failed', error: msg });
      }
    }

    return Response.json({ success: true, processed: results.length, results, timestamp: nowISO });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[sendPendingEmailsNow] Fatal:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
});