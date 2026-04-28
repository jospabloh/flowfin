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

// Queue email with notification_key deduplication (period-based or one-time)
async function queueEmail(base44, family_id, email_type, recipient_email, billing_period, metadata) {
  const notification_key = billing_period
    ? `${family_id}:${email_type}:${billing_period}`
    : `${family_id}:${email_type}`;

  // Check by notification_key first (preferred)
  const byKey = await base44.asServiceRole.entities.EmailNotification.filter({ notification_key });
  const alreadyQueued = byKey.some(e => e.status === 'sent' || e.status === 'pending');
  if (alreadyQueued) {
    return { queued: false, reason: 'duplicate_notification_key', notification_key };
  }

  await base44.asServiceRole.entities.EmailNotification.create({
    family_id,
    email_type,
    recipient_email,
    status: 'pending',
    retry_count: 0,
    notification_key,
    billing_period: billing_period || undefined,
    metadata: metadata || undefined,
    scheduled_for: new Date().toISOString(),
  });

  return { queued: true, notification_key };
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

    const queuedEmails = [];

    if (adminEmail) {
      const emailMetadata = {
        app_name: 'FlowFin',
        family_name: family.name,
        plan_name: planLabel,
        license_expires_at: newExpiresAt,
        billing_period: payment_period,
        user_name: memberships[0]?.user_name || null,
      };

      // Queue license_activated_welcome if first activation (trial/view_only/suspended → active)
      const wasInactive = ['trial', 'view_only', 'suspended'].includes(previousStatus);
      if (wasInactive || !family.license_activated_at) {
        const welcomeResult = await queueEmail(
          base44, family_id, 'license_activated_welcome', adminEmail,
          null, // one-time per family (no period key — use familyId:type)
          emailMetadata
        );
        if (welcomeResult.queued) queuedEmails.push('license_activated_welcome');
      }

      // Always queue payment_confirmed for this specific period (deduped by period)
      const confirmedResult = await queueEmail(
        base44, family_id, 'payment_confirmed', adminEmail,
        payment_period,
        emailMetadata
      );
      if (confirmedResult.queued) queuedEmails.push(`payment_confirmed:${payment_period}`);
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
      queued_emails: queuedEmails,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[confirmLicensePayment] Error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
});