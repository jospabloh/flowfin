import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// deliverEmails — usa Base44 Core.SendEmail (NO Resend)
// Envía todos los EmailNotification con status=pending

const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.flowfin.app';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtPeriod(p) {
  if (!p) return '—';
  const [y, m] = p.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

function html(body) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,sans-serif;background:#f1f5f9;margin:0;padding:16px}
.w{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.h{background:linear-gradient(135deg,#059669,#047857);padding:24px 32px;color:#fff}
.h h1{margin:0;font-size:18px;font-weight:700}
.h p{margin:4px 0 0;color:#a7f3d0;font-size:12px}
.b{padding:24px 32px;color:#374151;line-height:1.7;font-size:15px}
.b p{margin:0 0 12px}
.g{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px;color:#166534}
.cta{display:inline-block;padding:12px 28px;background:#059669;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;margin:16px 0}
.f{padding:16px 32px;background:#f8fafc;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
.f a{color:#059669}
</style></head><body><div class="w">
<div class="h"><h1>🌿 FlowFin</h1><p>Finanzas familiares · ACACIA</p></div>
<div class="b">${body}</div>
<div class="f">FlowFin — <strong>ACACIA Consultoría</strong> &nbsp;·&nbsp; <a href="mailto:soporte@acaciaco.com.mx">soporte@acaciaco.com.mx</a> &nbsp;·&nbsp; <a href="https://wa.me/524498958291">WhatsApp</a></div>
</div></body></html>`;
}

function buildEmail(type, ctx) {
  const name = ctx.family_name || 'tu familia';
  const hi = ctx.user_name ? `Hola ${ctx.user_name}` : 'Hola';
  const plan = ctx.plan_name || 'FlowFin Home';
  const exp = fmtDate(ctx.license_expires_at);
  const period = fmtPeriod(ctx.billing_period);
  const trialEnd = fmtDate(ctx.trial_end_at);
  const cta = `<a href="${APP_URL}" class="cta">`;

  const map = {
    payment_confirmed: {
      subject: 'Pago confirmado — tu licencia FlowFin continúa activa',
      body: `<p>${hi}!</p><p>ACACIA ha confirmado tu pago del período <strong>${period}</strong> para la familia <strong>${name}</strong>.</p><div class="g">✅ Tu plan <strong>${plan}</strong> continúa activo. Próximo vencimiento: <strong>${exp}</strong>.</div><p>Gracias por continuar con FlowFin.</p>${cta}Ir a FlowFin →</a>`,
    },
    license_activated_welcome: {
      subject: '¡Bienvenido a FlowFin! Tu plan ya está activo',
      body: `<p>${hi}!</p><p>Tu familia <strong>${name}</strong> ya tiene activo el plan <strong>${plan}</strong>. 🎉</p><div class="g">✅ FlowFin está listo: gastos, ingresos, reportes, pagos y más.</div>${cta}Entrar a FlowFin →</a>`,
    },
    trial_welcome: {
      subject: '¡Bienvenido a FlowFin! Tu prueba gratuita de 30 días comienza hoy',
      body: `<p>${hi}!</p><p>La familia <strong>${name}</strong> tiene acceso completo a FlowFin por <strong>30 días</strong> gratis.</p><div class="g">✅ Registra gastos, visualiza reportes, coordina pagos y más.<br>Tu prueba termina el <strong>${trialEnd}</strong>.</div>${cta}Empezar ahora →</a>`,
    },
    trial_ended: {
      subject: 'Tu prueba de FlowFin terminó — modo solo lectura activo',
      body: `<p>${hi}!</p><p>La prueba gratuita de <strong>${name}</strong> ha concluido. Tu cuenta está en <strong>modo solo lectura</strong>.</p><p>Para recuperar el acceso completo, activa tu plan:</p>${cta}Reactivar mi cuenta →</a>`,
    },
    trial_expiry_reminder_3d: {
      subject: 'Tu prueba de FlowFin termina en 3 días',
      body: `<p>${hi}!</p><p>Tu prueba gratuita termina en <strong>3 días</strong>. Activa tu plan para continuar sin interrupciones.</p>${cta}Ver planes →</a>`,
    },
    trial_expiry_reminder_2d: {
      subject: 'Tu prueba de FlowFin termina en 2 días',
      body: `<p>${hi}!</p><p>Tu prueba gratuita termina en <strong>2 días</strong>. Suscríbete en Mercado Pago y ACACIA activará tu licencia.</p>${cta}Activar mi plan →</a>`,
    },
    trial_expiry_reminder_1d: {
      subject: 'Tu prueba de FlowFin termina mañana',
      body: `<p>${hi}!</p><p>Tu prueba gratuita de <strong>${name}</strong> termina <strong>mañana</strong>. ¡Activa hoy!</p>${cta}Activar ahora →</a>`,
    },
    renewal_reminder_3d: {
      subject: 'Tu suscripción Mercado Pago se cobrará en 3 días',
      body: `<p>${hi}!</p><p>Tu suscripción de FlowFin para <strong>${name}</strong> se cobra en <strong>3 días</strong> vía Mercado Pago.</p><div class="g">ℹ️ ACACIA validará el pago y confirmará tu licencia.</div>${cta}Ir a FlowFin →</a>`,
    },
    renewal_reminder_2d: {
      subject: 'Tu suscripción Mercado Pago se cobrará en 2 días',
      body: `<p>${hi}!</p><p>Tu suscripción de <strong>${name}</strong> se cobra en <strong>2 días</strong>. ACACIA confirmará el pago.</p>${cta}Ir a FlowFin →</a>`,
    },
    renewal_reminder_1d: {
      subject: 'Tu suscripción Mercado Pago se cobrará mañana',
      body: `<p>${hi}!</p><p>Mañana Mercado Pago cobrará tu suscripción de <strong>${name}</strong>. ACACIA confirmará el acceso.</p>${cta}Ir a FlowFin →</a>`,
    },
  };

  const t = map[type];
  if (!t) return null;
  return { subject: t.subject, html: html(t.body) };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date().toISOString();
    const results = [];

    const pending = await base44.asServiceRole.entities.EmailNotification.filter({ status: 'pending' });
    console.log(`[deliverEmails] ${pending.length} pending`);

    for (const n of pending) {
      let ctx = {};
      if (n.metadata && typeof n.metadata === 'object') ctx = { ...n.metadata };
      try {
        const fams = await base44.asServiceRole.entities.Family.filter({ id: n.family_id });
        if (fams[0]) {
          const f = fams[0];
          ctx = {
            ...ctx,
            family_name: f.name,
            trial_end_at: ctx.trial_end_at || f.trial_end_at,
            license_expires_at: ctx.license_expires_at || f.license_expires_at,
            plan_name: ctx.plan_name || (f.license_plan === 'family_plus' ? 'FlowFin Family+' : 'FlowFin Home'),
            billing_period: ctx.billing_period || n.billing_period,
          };
        }
      } catch { /* non-fatal */ }

      const tpl = buildEmail(n.email_type, ctx);
      if (!tpl) {
        console.log(`[deliverEmails] No template for ${n.email_type} — skip`);
        results.push({ id: n.id, type: n.email_type, status: 'skipped' });
        continue;
      }

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: n.recipient_email,
          subject: tpl.subject,
          body: tpl.html,
          from_name: 'FlowFin',
        });
        await base44.asServiceRole.entities.EmailNotification.update(n.id, {
          status: 'sent', sent_at: now, last_attempt_at: now, error_message: null,
        });
        console.log(`[deliverEmails] ✓ Sent ${n.email_type} → ${n.recipient_email}`);
        results.push({ id: n.id, type: n.email_type, to: n.recipient_email, status: 'sent' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const cnt = (n.retry_count ?? 0) + 1;
        await base44.asServiceRole.entities.EmailNotification.update(n.id, {
          status: 'failed', retry_count: cnt, last_attempt_at: now, error_message: msg,
        });
        console.error(`[deliverEmails] ✗ ${n.email_type} → ${n.recipient_email}:`, msg);
        results.push({ id: n.id, type: n.email_type, to: n.recipient_email, status: 'failed', error: msg });
      }
    }

    return Response.json({ success: true, processed: results.length, results, timestamp: now });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[deliverEmails] Fatal:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
});