import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * confirmLicensePayment — Admin-only manual payment confirmation.
 *
 * This is the ONLY function that confirms a FlowFin license payment.
 * FlowFin does NOT auto-renew licenses. Mercado Pago handles external billing.
 * ACACIA/Pablo manually verifies payment in Mercado Pago, then calls this function.
 *
 * Security: Only app-level admins (user.role === 'admin') may call this.
 */

const PLAN_LIMITS = { home: 4, family_plus: 10, circle: 20 };
const PLAN_LABELS = { home: 'FlowFin Home', family_plus: 'FlowFin Family+', circle: 'FlowFin Circle' };

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// Calculate safe expiration: never shorten an active license.
// If current expiry is in the future, extend from there; otherwise extend from now.
function calculateExpiry(currentExpiresAt, monthsToExtend = 1) {
  const now = new Date();
  const base = currentExpiresAt && new Date(currentExpiresAt) > now
    ? new Date(currentExpiresAt)
    : now;

  const next = new Date(base);
  next.setMonth(next.getMonth() + monthsToExtend);
  // Always land on the 1st of the resulting month (aligns with Mercado Pago billing)
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

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

function buildPaymentConfirmedEmail(ctx) {
  const name = ctx.family_name || 'tu familia';
  const hi = ctx.user_name ? `Hola ${ctx.user_name}` : 'Hola';
  const plan = ctx.plan_name || 'FlowFin Home';
  const exp = fmtDate(ctx.license_expires_at);
  const period = fmtPeriod(ctx.billing_period);

  const body = `<p>${hi}!</p>
<p>ACACIA ha confirmado tu pago del período <strong>${period}</strong> para la familia <strong>${name}</strong>.</p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin:16px 0;font-size:13px;color:#166534">
  ✅ Tu plan <strong>${plan}</strong> continúa activo.<br>Tu próxima fecha de vencimiento es el <strong>${exp}</strong>.
</div>
<p>Gracias por continuar con FlowFin.</p>
<a href="${APP_URL}" style="display:inline-block;padding:12px 28px;background:#059669;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;margin:16px 0">Ir a FlowFin →</a>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,sans-serif;background:#f1f5f9;margin:0;padding:16px}
.w{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.h{background:linear-gradient(135deg,#059669,#047857);padding:24px 32px;color:#fff}
.h h1{margin:0;font-size:18px;font-weight:700}
.h p{margin:4px 0 0;color:#a7f3d0;font-size:12px}
.b{padding:24px 32px;color:#374151;line-height:1.7;font-size:15px}
.b p{margin:0 0 12px}
.f{padding:16px 32px;background:#f8fafc;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
.f a{color:#059669}
</style></head><body><div class="w">
<div class="h"><h1>🌿 FlowFin</h1><p>Finanzas familiares · ACACIA</p></div>
<div class="b">${body}</div>
<div class="f">FlowFin — <strong>ACACIA Consultoría</strong> &nbsp;·&nbsp; <a href="mailto:soporte@acaciaco.com.mx">soporte@acaciaco.com.mx</a> &nbsp;·&nbsp; <a href="https://wa.me/524498958291">WhatsApp</a></div>
</div></body></html>`;

  return {
    subject: 'Pago confirmado — tu licencia FlowFin continúa activa',
    html,
  };
}

// Send email immediately and record in EmailNotification
async function sendAndRecordEmail(base44, { family_id, email_type, recipient_email, billing_period, metadata }) {
  const notification_key = billing_period
    ? `${family_id}:${email_type}:${billing_period}`
    : `${family_id}:${email_type}`;

  // Dedup check
  const byKey = await base44.asServiceRole.entities.EmailNotification.filter({ notification_key });
  const alreadySent = byKey.some(e => e.status === 'sent');
  if (alreadySent) {
    return { sent: false, reason: 'already_sent', notification_key };
  }

  const nowISO = new Date().toISOString();
  const tpl = buildPaymentConfirmedEmail(metadata);

  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipient_email,
      subject: tpl.subject,
      body: tpl.html,
      from_name: 'FlowFin',
    });

    // Record as sent
    await base44.asServiceRole.entities.EmailNotification.create({
      family_id,
      email_type,
      recipient_email,
      status: 'sent',
      retry_count: 0,
      notification_key,
      billing_period: billing_period || undefined,
      metadata: metadata || undefined,
      scheduled_for: nowISO,
      sent_at: nowISO,
      last_attempt_at: nowISO,
    });

    return { sent: true, notification_key };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // Record as failed so scheduler can retry
    await base44.asServiceRole.entities.EmailNotification.create({
      family_id,
      email_type,
      recipient_email,
      status: 'failed',
      retry_count: 1,
      notification_key,
      billing_period: billing_period || undefined,
      metadata: metadata || undefined,
      scheduled_for: nowISO,
      last_attempt_at: nowISO,
      error_message: errMsg,
    });
    console.error(`[confirmLicensePayment] Email send failed: ${errMsg}`);
    return { sent: false, reason: errMsg, notification_key };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: solo administradores de plataforma pueden confirmar pagos' }, { status: 403 });
    }

    const body = await req.json();
    const {
      family_id,
      license_plan,
      payment_reference,
      payment_period,
      payment_notes,
      license_expires_at: adminProvidedExpiry,
      months_to_extend = 1,
      auto_renewal,
    } = body;

    if (!family_id) return Response.json({ error: 'family_id requerido' }, { status: 400 });
    if (!payment_period) return Response.json({ error: 'payment_period requerido (formato YYYY-MM)' }, { status: 400 });

    const plan = license_plan || 'home';
    if (!PLAN_LIMITS[plan]) {
      return Response.json({ error: `Plan inválido: ${plan}. Válidos: home, family_plus` }, { status: 400 });
    }

    const memberLimit = PLAN_LIMITS[plan];
    const planLabel = PLAN_LABELS[plan];
    const nowISO = new Date().toISOString();

    // Read current family (service role)
    const families = await base44.asServiceRole.entities.Family.filter({ id: family_id });
    if (!families || families.length === 0) {
      return Response.json({ error: `Familia no encontrada: ${family_id}` }, { status: 404 });
    }
    const family = families[0];
    const previousStatus = family.billing_status;

    // Calculate expiration
    const newExpiresAt = adminProvidedExpiry
      ? new Date(adminProvidedExpiry).toISOString()
      : calculateExpiry(family.license_expires_at, months_to_extend);

    // Build update payload
    const updateData = {
      billing_status: 'active',
      license_plan: plan,
      licensed_member_limit: memberLimit,
      license_activated_at: nowISO,
      license_expires_at: newExpiresAt,
      activated_by_admin: user.email,
      last_payment_confirmed_at: nowISO,
      last_payment_confirmed_by: user.email,
      last_payment_period: payment_period,
    };

    if (payment_reference !== undefined) {
      updateData.payment_reference = payment_reference;
      updateData.last_payment_reference = payment_reference;
    }
    if (payment_notes !== undefined) {
      updateData.last_payment_notes = payment_notes;
    }
    if (auto_renewal !== undefined) {
      updateData.auto_renewal = Boolean(auto_renewal);
    }

    await base44.asServiceRole.entities.Family.update(family_id, updateData);

    console.log(`[confirmLicensePayment] Family ${family_id} (${family.name}) payment confirmed by ${user.email}. Plan: ${plan}, Period: ${payment_period}, Expires: ${newExpiresAt}`);

    // Get family admin email for notifications
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      family_id,
      role: 'admin',
      status: 'approved',
    });
    const adminEmail = memberships[0]?.user_email ?? null;

    const sentEmails = [];

    if (adminEmail) {
      const emailMetadata = {
        app_name: 'FlowFin',
        family_name: family.name,
        plan_name: planLabel,
        license_expires_at: newExpiresAt,
        billing_period: payment_period,
        user_name: memberships[0]?.user_name || null,
      };

      // Send payment_confirmed immediately
      const confirmedResult = await sendAndRecordEmail(base44, {
        family_id,
        email_type: 'payment_confirmed',
        recipient_email: adminEmail,
        billing_period: payment_period,
        metadata: emailMetadata,
      });
      if (confirmedResult.sent) sentEmails.push(`payment_confirmed:${payment_period}`);
    }

    return Response.json({
      success: true,
      family_id,
      family_name: family.name,
      license_plan: plan,
      licensed_member_limit: memberLimit,
      license_expires_at: newExpiresAt,
      payment_period,
      previous_status: previousStatus,
      confirmed_by: user.email,
      sent_emails: sentEmails,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[confirmLicensePayment] Error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
});