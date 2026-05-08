// sendTestEmails: sends test emails using Base44 Core.SendEmail
// Tests all lifecycle email types to validate content and delivery
// Query param: ?to=email (default: user's email)
// All emails are sent via Base44's internal email system

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.flowfin.app';

const ALL_EMAIL_TYPES = [
  'trial_welcome',
  'trial_day20',
  'trial_day27',
  'trial_day29',
  'trial_ended',
  'archived_warning',
  'deletion_warning',
  'license_expiry_10d',
  'license_expiry_5d',
  'license_expiry_1d',
  'license_expired',
  'grace_period_warning',
  'license_view_only',
  'license_archived',
  'license_deletion_warning',
  'renewal_upcoming',
  'renewal_confirmed',
] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function wrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:20px}
  .c{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden}
  .h{background:#4f46e5;padding:24px 32px}
  .h h1{color:#fff;font-size:20px;margin:0;font-weight:700}
  .b{padding:32px;color:#374151;line-height:1.65;font-size:15px}
  .b p{margin:0 0 16px}
  .b ul{margin:0 0 16px;padding-left:20px}
  .b li{margin-bottom:6px}
  .cta{display:inline-block;margin:8px 0 24px;padding:13px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px}
  .hi{color:#4f46e5;font-weight:600}
  .warn{color:#d97706;font-weight:600}
  .danger{color:#dc2626;font-weight:600}
  .f{padding:18px 32px;background:#f1f5f9;font-size:12px;color:#94a3b8;line-height:1.5}
  .test-banner{background:#fef3c7;border-left:4px solid #d97706;padding:10px 16px;margin-bottom:20px;font-size:13px;color:#92400e}
</style>
</head>
<body>
<div class="c">
  <div class="h"><h1>FlowFin</h1></div>
  <div class="b">
    <div class="test-banner">⚠️ <strong>CORREO DE PRUEBA</strong> — Este mensaje fue generado para validar la automatización.</div>
    ${content}
  </div>
  <div class="f">FlowFin — Finanzas familiares inteligentes<br>
  ¿Dudas? Escríbenos a <a href="mailto:soporte@flowfin.app" style="color:#4f46e5">soporte@flowfin.app</a></div>
</div>
</body>
</html>`;
}

function getEmailTemplate(
  email_type: string,
  ctx: Record<string, string>
): { subject: string; html: string } | null {
  const name = ctx.family_name;
  const trialEnd = formatDate(ctx.trial_end_at);
  const licenseExpires = formatDate(ctx.license_expires_at);
  const scheduledDelete = formatDate(ctx.scheduled_delete_at);
  const cta = `<a href="${APP_URL}" class="cta">`;

  const templates: Record<string, { subject: string; body: string }> = {
    trial_welcome: {
      subject: `¡Bienvenido a FlowFin! Tu prueba gratuita de 30 días comienza hoy`,
      body: `<p>¡Hola!</p>
<p>La familia <span class="hi">${name}</span> ya tiene acceso completo a FlowFin durante los próximos <span class="hi">30 días</span>, completamente gratis.</p>
<p>Con FlowFin puedes:</p>
<ul>
  <li>Registrar y categorizar todos los gastos familiares</li>
  <li>Visualizar presupuestos y reportes en tiempo real</li>
  <li>Coordinar pagos programados, inversiones y rentas</li>
  <li>Invitar a todos los integrantes de tu familia</li>
</ul>
${cta}Empezar ahora →</a>
<p>Tu prueba termina el <strong>${trialEnd}</strong>. No realizamos cargos automáticos — la activación es manual y sin sorpresas.</p>`,
    },

    trial_day20: {
      subject: `${name}: te quedan 10 días de prueba gratuita en FlowFin`,
      body: `<p>¡Hola!</p>
<p>Ya llevas 20 días usando FlowFin con la familia <span class="hi">${name}</span>. ¡Excelente!</p>
<p>Tu prueba gratuita termina en <span class="warn">10 días</span>, el ${trialEnd}.</p>
<p>Para seguir disfrutando de FlowFin sin interrupciones, activa tu plan antes de esa fecha. Todos tus datos estarán disponibles exactamente como los dejaste.</p>
${cta}Ver planes y activar →</a>
<p>Sin renovación automática — la activación es 100% manual.</p>`,
    },

    trial_day27: {
      subject: `Quedan 3 días — No pierdas el acceso a FlowFin, ${name}`,
      body: `<p>¡Hola!</p>
<p>Tu prueba gratuita de FlowFin para <span class="hi">${name}</span> está por terminar.</p>
<p>Solo tienes <span class="warn">3 días</span> para activar tu plan y mantener el acceso completo. Si no activas antes del ${trialEnd}, tu cuenta pasará a <strong>modo solo lectura</strong> — podrás ver tus datos, pero no agregar nuevos registros.</p>
${cta}Activar mi plan ahora →</a>
<p>Tus datos están seguros. Solo activa a tiempo para seguir sin interrupciones.</p>`,
    },

    trial_day29: {
      subject: `¡Último aviso! Tu prueba de FlowFin termina mañana`,
      body: `<p>¡Hola!</p>
<p>Mañana termina la prueba gratuita de FlowFin para la familia <span class="hi">${name}</span>.</p>
<p>A partir del <span class="danger">${trialEnd}</span> tu cuenta entrará en modo solo lectura. No perderás ningún dato, pero no podrás registrar nuevos gastos, pagos ni movimientos.</p>
<p>Activa hoy y continúa sin ninguna interrupción:</p>
${cta}Activar ahora — último día →</a>`,
    },

    trial_ended: {
      subject: `Tu prueba de FlowFin terminó — ${name} ahora está en modo solo lectura`,
      body: `<p>¡Hola!</p>
<p>El período de prueba gratuita de la familia <span class="hi">${name}</span> ha concluido.</p>
<p>Tu cuenta está ahora en <span class="warn">modo solo lectura</span>. Puedes consultar todos tus registros históricos, pero no es posible agregar, editar ni eliminar información.</p>
<p>Tus datos están seguros. Para recuperar el acceso completo, activa tu plan en cualquier momento:</p>
${cta}Reactivar mi cuenta →</a>
<p>Si no activas en los próximos 15 días, tu cuenta será archivada.</p>`,
    },

    archived_warning: {
      subject: `Aviso importante: la cuenta de ${name} será archivada pronto`,
      body: `<p>¡Hola!</p>
<p>Han pasado varios días desde que la cuenta de <span class="hi">${name}</span> entró en modo solo lectura.</p>
<p>En los próximos días, tu cuenta será <span class="danger">archivada</span>. Una vez archivada, no podrás acceder a tus datos. Después de 30 días adicionales, la cuenta y todos sus datos serán eliminados permanentemente.</p>
${cta}Reactivar antes de que sea tarde →</a>
<p>Si ya no utilizas FlowFin, no necesitas hacer nada. ¿Dudas? Escríbenos a soporte@flowfin.app.</p>`,
    },

    deletion_warning: {
      subject: `AVISO FINAL: Los datos de ${name} serán eliminados en 3 días`,
      body: `<p>¡Hola!</p>
<p>Este es un aviso final importante.</p>
<p>La cuenta de <span class="hi">${name}</span> ha estado archivada y sus datos serán <span class="danger">eliminados permanentemente el ${scheduledDelete}</span>.</p>
<p>Esta acción no puede deshacerse. Si deseas conservar tu historial, activa tu plan ahora:</p>
${cta}Reactivar y salvar mis datos →</a>
<p>Si ya no necesitas FlowFin, no necesitas hacer nada más.</p>`,
    },

    license_expiry_10d: {
      subject: `Tu licencia de FlowFin vence en 10 días — ${name}`,
      body: `<p>¡Hola!</p>
<p>Tu licencia activa de FlowFin para <span class="hi">${name}</span> vence el <span class="warn">${licenseExpires}</span>, en 10 días.</p>
<p>Para renovar y continuar sin interrupciones:</p>
${cta}Renovar mi licencia →</a>
<p>No realizamos cargos automáticos. Si ya realizaste tu pago, contáctanos con tu comprobante y lo procesamos de inmediato.</p>`,
    },

    license_expiry_5d: {
      subject: `5 días para que venza tu licencia de FlowFin — Renueva ahora`,
      body: `<p>¡Hola!</p>
<p>Tu licencia de FlowFin para <span class="hi">${name}</span> vence en <span class="warn">5 días</span> (${licenseExpires}).</p>
<p>Renueva hoy para evitar interrupciones en el acceso de tu familia:</p>
${cta}Renovar mi licencia →</a>`,
    },

    license_expiry_1d: {
      subject: `¡Tu licencia de FlowFin vence mañana! Renueva hoy, ${name}`,
      body: `<p>¡Hola!</p>
<p>Tu licencia de FlowFin para <span class="hi">${name}</span> vence <span class="danger">mañana</span>, el ${licenseExpires}.</p>
<p>Renueva antes de que expire para no perder el acceso:</p>
${cta}Renovar ahora — último día →</a>`,
    },

    license_expired: {
      subject: `Tu licencia de FlowFin venció — Tienes 3 días de gracia, ${name}`,
      body: `<p>¡Hola!</p>
<p>La licencia de FlowFin para <span class="hi">${name}</span> venció hoy.</p>
<p>Tienes un <span class="warn">período de gracia de 3 días</span> para renovar y mantener el acceso completo sin ninguna interrupción. Después de ese período, la cuenta pasará a modo solo lectura.</p>
${cta}Renovar durante el período de gracia →</a>`,
    },

    grace_period_warning: {
      subject: `Período de gracia activo — Renueva FlowFin antes de perder acceso`,
      body: `<p>¡Hola!</p>
<p>Tu cuenta de FlowFin para <span class="hi">${name}</span> está en su período de gracia post-vencimiento.</p>
<p>Si no renuevas tu licencia en los próximos días, el acceso completo se suspenderá y la cuenta pasará a modo solo lectura.</p>
${cta}Renovar mi licencia →</a>`,
    },

    license_view_only: {
      subject: `${name} ahora está en modo solo lectura — Renueva para reactivar`,
      body: `<p>¡Hola!</p>
<p>El período de gracia ha terminado. La cuenta de <span class="hi">${name}</span> está ahora en <span class="warn">modo solo lectura</span>.</p>
<p>Puedes consultar todos tus registros históricos, pero no es posible agregar ni modificar información.</p>
<p>Para reactivar el acceso completo, renueva tu licencia:</p>
${cta}Renovar mi licencia →</a>
<p>Si no renuevas en los próximos 15 días, la cuenta será archivada.</p>`,
    },

    license_archived: {
      subject: `Aviso: la cuenta de ${name} ha sido archivada`,
      body: `<p>¡Hola!</p>
<p>La cuenta de <span class="hi">${name}</span> ha sido archivada tras varios días en modo solo lectura sin renovación.</p>
<p>Tienes <span class="danger">30 días</span> para reactivar tu cuenta y recuperar todos tus datos antes de que sean eliminados permanentemente.</p>
${cta}Reactivar mi cuenta →</a>
<p>¿Dudas? Escríbenos a soporte@flowfin.app.</p>`,
    },

    license_deletion_warning: {
      subject: `AVISO FINAL: Los datos de ${name} serán eliminados en 3 días`,
      body: `<p>¡Hola!</p>
<p>Este es un aviso final importante.</p>
<p>La cuenta de <span class="hi">${name}</span> ha estado archivada y sus datos serán <span class="danger">eliminados permanentemente el ${scheduledDelete}</span>.</p>
<p>Esta acción no puede deshacerse. Si deseas conservar tu historial, activa tu plan ahora:</p>
${cta}Reactivar y salvar mis datos →</a>`,
    },

    renewal_upcoming: {
      subject: `Tu suscripción de FlowFin se renovará automáticamente el día 1`,
      body: `<p>¡Hola!</p>
<p>Te recordamos que tu suscripción de FlowFin para <span class="hi">${name}</span> se <span class="hi">renovará automáticamente el próximo día 1 del mes</span>.</p>
<p>No necesitas hacer nada — el acceso de tu familia continuará sin interrupciones.</p>
<p>Si necesitas hacer algún cambio a tu plan o tienes preguntas, contáctanos antes de la fecha de renovación:</p>
${cta}Ver mi cuenta →</a>`,
    },

    renewal_confirmed: {
      subject: `¡Suscripción renovada! FlowFin activo para ${name}`,
      body: `<p>¡Hola!</p>
<p>Tu suscripción de FlowFin para <span class="hi">${name}</span> ha sido <span class="hi">renovada exitosamente</span>.</p>
<p>El acceso completo de tu familia continúa activo. Gracias por confiar en FlowFin.</p>
${cta}Ir a FlowFin →</a>
<p>Si tienes alguna pregunta sobre tu suscripción, escríbenos a soporte@flowfin.app.</p>`,
    },
  };

  const t = templates[email_type];
  if (!t) return null;
  return { subject: `[PRUEBA] ${t.subject}`, html: wrap(t.body) };
}

async function sendViaBase44(base44: { asServiceRole: { integrations: { Core: { SendEmail: (opts: { to: string; subject: string; body: string }) => Promise<unknown> } } } }, to: string, subject: string, html: string): Promise<void> {
  await base44.asServiceRole.integrations.Core.SendEmail({
    to,
    subject,
    body: html,
    from_name: 'FlowFin',
  });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const to = url.searchParams.get('to') ?? user.email;

  const ctx: Record<string, string> = {
    family_name: 'Familia Demo',
    trial_end_at: daysFromNow(30),
    license_expires_at: daysFromNow(30),
    scheduled_delete_at: daysFromNow(3),
  };

  const results: Array<{ type: string; subject: string; status: string; error?: string }> = [];
  let sent = 0;
  let failed = 0;

  for (const emailType of ALL_EMAIL_TYPES) {
    const template = getEmailTemplate(emailType, ctx);
    if (!template) {
      results.push({ type: emailType, subject: '', status: 'skipped' });
      continue;
    }
    try {
      await sendViaBase44(base44, to, template.subject, template.html);
      results.push({ type: emailType, subject: template.subject, status: 'sent' });
      sent++;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      results.push({ type: emailType, subject: template.subject, status: 'failed', error: errorMessage });
      failed++;
      console.error(`[sendTestEmails] Failed ${emailType}:`, errorMessage);
    }
  }

  console.log(`[sendTestEmails] to=${to} sent=${sent} failed=${failed}`);
  return Response.json({ to, sent, failed, total: ALL_EMAIL_TYPES.length, results });
});