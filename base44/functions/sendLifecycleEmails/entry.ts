import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * sendLifecycleEmails — Daily scheduled function.
 * Delivers all pending EmailNotification records via Base44 SendEmail integration.
 * Run after checkAccountLifecycle and queueBillingReminders.
 *
 * Scheduler order (daily):
 * 1. checkAccountLifecycle
 * 2. queueBillingReminders
 * 3. sendLifecycleEmails  ← this function
 */

const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.flowfin.app';
const MAX_RETRIES = 3;

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

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

// ── HTML wrapper ──────────────────────────────────────────────────────────────
function wrap(content) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;margin:0;padding:16px}
  .wrap{max-width:560px;margin:0 auto}
  .card{background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .hdr{background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px 32px}
  .hdr-logo{display:flex;align-items:center;gap:10px}
  .hdr-logo-dot{width:32px;height:32px;background:#ffffff20;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px}
  .hdr h1{color:#fff;font-size:18px;margin:0;font-weight:700;letter-spacing:-0.3px}
  .hdr p{color:#a7f3d0;font-size:12px;margin:4px 0 0}
  .body{padding:28px 32px;color:#374151;line-height:1.7;font-size:15px}
  .body p{margin:0 0 14px}
  .body ul{margin:0 0 14px;padding-left:22px}
  .body li{margin-bottom:5px}
  .hi{color:#059669;font-weight:600}
  .warn{color:#d97706;font-weight:600}
  .danger{color:#dc2626;font-weight:600}
  .info-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin:16px 0}
  .info-box p{margin:0;font-size:13px;color:#166534}
  .warn-box{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin:16px 0}
  .warn-box p{margin:0;font-size:13px;color:#92400e}
  .cta-wrap{margin:20px 0}
  .cta{display:inline-block;padding:13px 28px;background:#059669;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px}
  .footer{padding:18px 32px;background:#f8fafc;font-size:12px;color:#94a3b8;line-height:1.5;border-top:1px solid #e2e8f0}
  .footer a{color:#059669}
  @media(max-width:600px){.body{padding:20px 20px}.hdr{padding:20px 20px}.footer{padding:14px 20px}}
</style>
</head>
<body>
<div class="wrap">
<div class="card">
  <div class="hdr">
    <div class="hdr-logo">
      <div class="hdr-logo-dot">🌿</div>
      <div>
        <h1>FlowFin</h1>
        <p>Finanzas familiares inteligentes · ACACIA</p>
      </div>
    </div>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    FlowFin — desarrollado por <strong>ACACIA Consultoría</strong><br>
    ¿Dudas o cambios en tu plan? <a href="mailto:soporte@acaciaco.com.mx">soporte@acaciaco.com.mx</a>
    &nbsp;·&nbsp; <a href="https://wa.me/524498958291">WhatsApp</a>
  </div>
</div>
</div>
</body>
</html>`;
}

// ── Email templates ───────────────────────────────────────────────────────────
function getEmailTemplate(email_type, ctx) {
  const name = ctx.family_name || 'tu familia';
  const userName = ctx.user_name ? `Hola ${ctx.user_name}` : 'Hola';
  const planName = ctx.plan_name || 'FlowFin Home';
  const trialEnd = formatDate(ctx.trial_end_at);
  const licenseExpires = ctx.license_expires_at ? formatDate(ctx.license_expires_at) : '—';
  const scheduledDelete = formatDate(ctx.scheduled_delete_at);
  const billingPeriod = ctx.billing_period ? formatYYYYMM(ctx.billing_period) : '—';
  const cta = `<div class="cta-wrap"><a href="${APP_URL}" class="cta">`;
  const ctaEnd = `</a></div>`;

  const templates = {
    trial_welcome: {
      subject: '¡Bienvenido a FlowFin! Tu prueba gratuita de 30 días comienza hoy',
      body: `<p>${userName}!</p>
<p>La familia <span class="hi">${name}</span> ya tiene acceso completo a FlowFin durante los próximos <span class="hi">30 días</span>, completamente gratis.</p>
<p>Con FlowFin puedes:</p>
<ul>
  <li>Registrar y categorizar todos los gastos e ingresos familiares</li>
  <li>Visualizar presupuestos y reportes en tiempo real</li>
  <li>Coordinar pagos programados, inversiones, MSI y rentas</li>
  <li>Invitar a todos los integrantes de tu familia</li>
</ul>
${cta}Empezar ahora →${ctaEnd}
<p>Tu prueba termina el <strong>${trialEnd}</strong>. No realizamos cargos automáticos — la activación es manual a través de Mercado Pago y confirmada por ACACIA.</p>`,
    },

    trial_day20: {
      subject: `${name}: te quedan 10 días de prueba gratuita en FlowFin`,
      body: `<p>¡Hola!</p>
<p>Ya llevas 20 días usando FlowFin con la familia <span class="hi">${name}</span>. ¡Excelente!</p>
<p>Tu prueba gratuita termina en <span class="warn">10 días</span>, el ${trialEnd}.</p>
<p>Para seguir disfrutando sin interrupciones, elige tu plan en FlowFin y suscríbete vía Mercado Pago. Una vez que ACACIA valide tu pago, tu licencia quedará activa.</p>
${cta}Ver planes →${ctaEnd}`,
    },

    trial_day27: {
      subject: `Quedan 3 días — No pierdas el acceso a FlowFin, ${name}`,
      body: `<p>¡Hola!</p>
<p>Tu prueba gratuita de FlowFin para <span class="hi">${name}</span> está por terminar.</p>
<p>Solo tienes <span class="warn">3 días</span> para activar tu plan. Si no activas antes del ${trialEnd}, tu cuenta pasará a <strong>modo solo lectura</strong>.</p>
${cta}Activar mi plan ahora →${ctaEnd}
<p>Tus datos están seguros. El pago se procesa en Mercado Pago y ACACIA activa tu licencia.</p>`,
    },

    trial_day29: {
      subject: '¡Último aviso! Tu prueba de FlowFin termina mañana',
      body: `<p>¡Hola!</p>
<p>Mañana termina la prueba gratuita de FlowFin para la familia <span class="hi">${name}</span>.</p>
<p>A partir del <span class="danger">${trialEnd}</span> tu cuenta entrará en modo solo lectura. No perderás ningún dato, pero no podrás registrar nuevos movimientos.</p>
${cta}Activar ahora — último día →${ctaEnd}`,
    },

    trial_ended: {
      subject: `Tu prueba de FlowFin terminó — ${name} ahora está en modo solo lectura`,
      body: `<p>¡Hola!</p>
<p>El período de prueba gratuita de la familia <span class="hi">${name}</span> ha concluido.</p>
<p>Tu cuenta está ahora en <span class="warn">modo solo lectura</span>. Puedes consultar todos tus registros históricos, pero no es posible agregar, editar ni eliminar información.</p>
<p>Para recuperar el acceso completo, elige tu plan y suscríbete en Mercado Pago:</p>
${cta}Reactivar mi cuenta →${ctaEnd}`,
    },

    archived_warning: {
      subject: `Aviso importante: la cuenta de ${name} será archivada pronto`,
      body: `<p>¡Hola!</p>
<p>Han pasado varios días desde que la cuenta de <span class="hi">${name}</span> entró en modo solo lectura.</p>
<p>En los próximos días, tu cuenta será <span class="danger">archivada</span>. Después de 30 días adicionales, la cuenta y todos sus datos serán eliminados permanentemente.</p>
${cta}Reactivar antes de que sea tarde →${ctaEnd}
<p>¿Dudas? Escríbenos a soporte@acaciaco.com.mx</p>`,
    },

    deletion_warning: {
      subject: `AVISO FINAL: Los datos de ${name} serán eliminados en 3 días`,
      body: `<p>¡Hola!</p>
<p>La cuenta de <span class="hi">${name}</span> ha estado archivada y sus datos serán <span class="danger">eliminados permanentemente el ${scheduledDelete}</span>.</p>
<p>Esta acción no puede deshacerse. Si deseas conservar tu historial, activa tu plan ahora:</p>
${cta}Reactivar y salvar mis datos →${ctaEnd}`,
    },

    license_expiry_10d: {
      subject: `Tu licencia de FlowFin vence en 10 días — ${name}`,
      body: `<p>¡Hola!</p>
<p>Tu licencia de FlowFin para <span class="hi">${name}</span> vence el <span class="warn">${licenseExpires}</span>, en 10 días.</p>
<p>Para renovar, suscríbete vía Mercado Pago. Una vez que ACACIA valide tu pago, tu licencia se extenderá sin interrupciones.</p>
${cta}Renovar mi licencia →${ctaEnd}`,
    },

    license_expiry_5d: {
      subject: `5 días para que venza tu licencia de FlowFin — Renueva ahora`,
      body: `<p>¡Hola!</p>
<p>Tu licencia de FlowFin para <span class="hi">${name}</span> vence en <span class="warn">5 días</span> (${licenseExpires}).</p>
${cta}Renovar mi licencia →${ctaEnd}`,
    },

    license_expiry_1d: {
      subject: `¡Tu licencia de FlowFin vence mañana! Renueva hoy, ${name}`,
      body: `<p>¡Hola!</p>
<p>Tu licencia de FlowFin para <span class="hi">${name}</span> vence <span class="danger">mañana</span>, el ${licenseExpires}.</p>
${cta}Renovar ahora — último día →${ctaEnd}`,
    },

    license_expired: {
      subject: `Tu licencia de FlowFin venció — Tienes 3 días de gracia, ${name}`,
      body: `<p>¡Hola!</p>
<p>La licencia de FlowFin para <span class="hi">${name}</span> venció hoy.</p>
<p>Tienes un <span class="warn">período de gracia de 3 días</span> para renovar. Después de ese período, la cuenta pasará a modo solo lectura.</p>
${cta}Renovar durante el período de gracia →${ctaEnd}`,
    },

    grace_period_warning: {
      subject: 'Período de gracia activo — Renueva FlowFin antes de perder acceso',
      body: `<p>¡Hola!</p>
<p>Tu cuenta de FlowFin para <span class="hi">${name}</span> está en su período de gracia post-vencimiento.</p>
<p>Si no renuevas tu licencia en los próximos días, el acceso completo se suspenderá.</p>
${cta}Renovar mi licencia →${ctaEnd}`,
    },

    license_view_only: {
      subject: `${name} ahora está en modo solo lectura — Renueva para reactivar`,
      body: `<p>¡Hola!</p>
<p>El período de gracia ha terminado. La cuenta de <span class="hi">${name}</span> está ahora en <span class="warn">modo solo lectura</span>.</p>
<p>Para reactivar el acceso completo, renueva tu licencia:</p>
${cta}Renovar mi licencia →${ctaEnd}`,
    },

    license_archived: {
      subject: `Aviso: la cuenta de ${name} ha sido archivada`,
      body: `<p>¡Hola!</p>
<p>La cuenta de <span class="hi">${name}</span> ha sido archivada tras varios días en modo solo lectura sin renovación.</p>
<p>Tienes <span class="danger">30 días</span> para reactivar tu cuenta antes de que los datos sean eliminados permanentemente.</p>
${cta}Reactivar mi cuenta →${ctaEnd}`,
    },

    license_deletion_warning: {
      subject: `AVISO FINAL: Los datos de ${name} serán eliminados en 3 días`,
      body: `<p>¡Hola!</p>
<p>La cuenta de <span class="hi">${name}</span> ha estado archivada y sus datos serán <span class="danger">eliminados permanentemente el ${scheduledDelete}</span>.</p>
${cta}Reactivar y salvar mis datos →${ctaEnd}`,
    },

    renewal_upcoming: {
      subject: 'Recordatorio: tu suscripción Mercado Pago se cobrará pronto',
      body: `<p>¡Hola!</p>
<p>Te recordamos que tu suscripción de FlowFin para <span class="hi">${name}</span> se gestiona mediante <strong>Mercado Pago</strong>.</p>
<p>El cobro está programado para el <strong>día 1 del próximo mes</strong>.</p>
<div class="info-box">
  <p>ℹ️ Una vez que ACACIA valide el pago recibido, tu licencia FlowFin continuará activa sin interrupciones.</p>
</div>
<p>Si tienes dudas o hubo algún cambio en tu método de pago en Mercado Pago, contáctanos antes de la fecha de cobro.</p>
${cta}Ir a FlowFin →${ctaEnd}`,
    },

    renewal_confirmed: {
      subject: `Pago confirmado — tu licencia FlowFin continúa activa`,
      body: `<p>¡Hola!</p>
<p>ACACIA ha confirmado el pago para la familia <span class="hi">${name}</span>.</p>
<p>Tu plan FlowFin continúa activo. Gracias por confiar en nosotros.</p>
${cta}Ir a FlowFin →${ctaEnd}`,
    },

    trial_expiry_reminder_3d: {
      subject: 'Tu prueba de FlowFin termina en 3 días',
      body: `<p>¡Hola!</p>
<p>Tu prueba gratuita de FlowFin para la familia <span class="hi">${name}</span> termina en <span class="warn">3 días</span>.</p>
<p>Para continuar con acceso completo:</p>
<ul>
  <li>Elige tu plan desde la página de FlowFin</li>
  <li>Completa tu suscripción en Mercado Pago</li>
  <li>ACACIA validará el pago y activará tu licencia</li>
</ul>
${cta}Ver planes →${ctaEnd}`,
    },

    trial_expiry_reminder_2d: {
      subject: 'Tu prueba de FlowFin termina en 2 días',
      body: `<p>¡Hola!</p>
<p>Tu prueba gratuita de FlowFin para la familia <span class="hi">${name}</span> termina en <span class="warn">2 días</span>.</p>
<p>Para continuar sin interrupciones, suscríbete en Mercado Pago. ACACIA activará tu licencia una vez validado el pago.</p>
${cta}Activar mi plan →${ctaEnd}`,
    },

    trial_expiry_reminder_1d: {
      subject: 'Tu prueba de FlowFin termina mañana',
      body: `<p>¡Hola!</p>
<p>Tu prueba gratuita de FlowFin para la familia <span class="hi">${name}</span> termina <span class="danger">mañana</span>.</p>
<p>¡Activa tu plan hoy para evitar cualquier interrupción! El pago se gestiona en Mercado Pago y ACACIA activa tu licencia.</p>
${cta}Activar ahora →${ctaEnd}`,
    },

    renewal_reminder_3d: {
      subject: 'Tu suscripción Mercado Pago se cobrará en 3 días',
      body: `<p>¡Hola!</p>
<p>Este es un recordatorio de que tu suscripción de FlowFin para <span class="hi">${name}</span> se gestiona mediante <strong>Mercado Pago</strong>.</p>
<p>El cobro está programado para el <strong>día 1</strong> (en 3 días).</p>
<div class="warn-box">
  <p>⚠️ Una vez que ACACIA valide el pago recibido en Mercado Pago, tu licencia FlowFin continuará activa.</p>
</div>
<p>Si tienes dudas o hubo algún cambio en tu método de pago, contáctanos antes de la fecha de cobro:</p>
${cta}Ir a FlowFin →${ctaEnd}`,
    },

    renewal_reminder_2d: {
      subject: 'Tu suscripción Mercado Pago se cobrará en 2 días',
      body: `<p>¡Hola!</p>
<p>Tu suscripción de FlowFin para <span class="hi">${name}</span> en <strong>Mercado Pago</strong> se cobrará en <span class="warn">2 días</span>.</p>
<div class="warn-box">
  <p>⚠️ Este cobro es gestionado por Mercado Pago de forma externa. FlowFin no realiza cargos directos. ACACIA validará el pago y confirmará tu acceso.</p>
</div>
<p>¿Tienes alguna duda sobre tu método de pago? Escríbenos antes del día 1.</p>
${cta}Ir a FlowFin →${ctaEnd}`,
    },

    renewal_reminder_1d: {
      subject: 'Tu suscripción Mercado Pago se cobrará mañana',
      body: `<p>¡Hola!</p>
<p>Mañana, <strong>día 1 del mes</strong>, Mercado Pago realizará el cobro de tu suscripción de FlowFin para la familia <span class="hi">${name}</span>.</p>
<div class="warn-box">
  <p>⚠️ El cobro se gestiona en Mercado Pago. Una vez que ACACIA confirme el pago, tu licencia FlowFin continuará activa para el próximo mes.</p>
</div>
<p>Si hay algún problema con tu método de pago en Mercado Pago, contáctanos de inmediato.</p>
${cta}Ir a FlowFin →${ctaEnd}`,
    },

    license_activated_welcome: {
      subject: '¡Bienvenido a FlowFin! Tu plan ya está activo',
      body: `<p>${userName}!</p>
<p>Tu familia <span class="hi">${name}</span> ya tiene activo el plan <span class="hi">${planName}</span> en FlowFin.</p>
<p>Gracias por confiar en ACACIA. 🎉</p>
<div class="info-box">
  <p>✅ FlowFin está listo para ayudarte a organizar ingresos, egresos, pagos programados, rentas, reportes y metas financieras con una experiencia clara y simple.</p>
</div>
<p>Accede cuando quieras desde cualquier dispositivo:</p>
${cta}Entrar a FlowFin →${ctaEnd}`,
    },

    payment_confirmed: {
      subject: 'Pago confirmado — tu licencia FlowFin continúa activa',
      body: `<p>${userName}!</p>
<p>ACACIA ha confirmado tu pago del período <span class="hi">${billingPeriod}</span> para la familia <span class="hi">${name}</span>.</p>
<div class="info-box">
  <p>✅ Tu plan <strong>${planName}</strong> continúa activo.<br>Tu próxima fecha de vencimiento es el <strong>${licenseExpires}</strong>.</p>
</div>
<p>Gracias por continuar con FlowFin. Tu suscripción Mercado Pago sigue activa para el siguiente ciclo.</p>
${cta}Ir a FlowFin →${ctaEnd}`,
    },
  };

  const t = templates[email_type];
  if (!t) return null;
  return { subject: t.subject, html: wrap(t.body) };
}

// ── Main handler ───────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const nowISO = new Date().toISOString();
    const stats = { sent: 0, failed: 0, skipped: 0, retried: 0 };

    // Gather pending + retryable failed notifications
    const pending = await base44.asServiceRole.entities.EmailNotification.filter({ status: 'pending' });
    const failed = await base44.asServiceRole.entities.EmailNotification.filter({ status: 'failed' });
    const retryable = failed.filter(n => (n.retry_count ?? 0) < MAX_RETRIES);
    const toProcess = [...pending, ...retryable];

    for (const notification of toProcess) {
      // Dedup check: if a record with the same notification_key is already sent, skip
      if (notification.notification_key) {
        const byKey = await base44.asServiceRole.entities.EmailNotification.filter({
          notification_key: notification.notification_key,
          status: 'sent',
        });
        if (byKey.length > 0) {
          await base44.asServiceRole.entities.EmailNotification.update(notification.id, { status: 'sent' });
          stats.skipped++;
          continue;
        }
      } else {
        const sentCheck = await base44.asServiceRole.entities.EmailNotification.filter({
          family_id: notification.family_id,
          email_type: notification.email_type,
          status: 'sent',
        });
        if (sentCheck.length > 0) {
          await base44.asServiceRole.entities.EmailNotification.update(notification.id, { status: 'sent' });
          stats.skipped++;
          continue;
        }
      }

      // Fetch family context + metadata for template rendering
      let ctx = { family_name: '' };
      try {
        if (notification.metadata && typeof notification.metadata === 'object') {
          ctx = { ...notification.metadata };
        }
        const families = await base44.asServiceRole.entities.Family.filter({ id: notification.family_id });
        if (families[0]) {
          const f = families[0];
          ctx = {
            family_name: f.name,
            trial_end_at: f.trial_end_at,
            license_expires_at: ctx.license_expires_at || f.license_expires_at,
            scheduled_delete_at: f.scheduled_delete_at,
            archived_at: f.archived_at,
            plan_name: ctx.plan_name || (f.license_plan === 'family_plus' ? 'FlowFin Family+' : 'FlowFin Home'),
            billing_period: ctx.billing_period || notification.billing_period,
            user_name: ctx.user_name || null,
            app_name: 'FlowFin',
            days_left: ctx.days_left || null,
            days_to_first: ctx.days_to_first || null,
          };
        }
      } catch { /* non-fatal */ }

      const template = getEmailTemplate(notification.email_type, ctx);
      if (!template) {
        stats.skipped++;
        continue;
      }

      try {
        // Use Base44 built-in SendEmail integration
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: notification.recipient_email,
          subject: template.subject,
          body: template.html,
          from_name: 'FlowFin',
        });
        await base44.asServiceRole.entities.EmailNotification.update(notification.id, {
          status: 'sent',
          sent_at: nowISO,
          last_attempt_at: nowISO,
        });
        if (notification.status === 'failed') stats.retried++;
        stats.sent++;
      } catch (err) {
        const message = getErrorMessage(err);
        const newCount = (notification.retry_count ?? 0) + 1;
        await base44.asServiceRole.entities.EmailNotification.update(notification.id, {
          status: 'failed',
          retry_count: newCount,
          last_attempt_at: nowISO,
          error_message: message,
        });
        stats.failed++;
        console.error(`[sendLifecycleEmails] Failed ${notification.email_type} for family ${notification.family_id} (attempt ${newCount}):`, message);
      }
    }

    console.log('[sendLifecycleEmails]', JSON.stringify({ ...stats, timestamp: nowISO }));
    return Response.json({ success: true, ...stats, timestamp: nowISO });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[sendLifecycleEmails] Fatal error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
});