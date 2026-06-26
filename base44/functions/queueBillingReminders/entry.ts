import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { guardInternal } from './_internalGuard.ts';

/**
 * queueBillingReminders — Daily scheduled function.
 *
 * Queues billing reminder emails for:
 * 1. Trial families approaching expiry (3d, 2d, 1d before trial_end_at)
 * 2. Active families with Mercado Pago subscription (auto_renewal=true)
 *    approaching the 1st of next month (3d, 2d, 1d before the 1st)
 *
 * IMPORTANT: These are REMINDERS ONLY.
 * - renewal_reminder_* emails tell users that Mercado Pago will attempt the charge
 *   and that ACACIA will validate payment manually.
 * - FlowFin does NOT auto-renew. Only confirmLicensePayment does that.
 *
 * Deduplication: uses notification_key = familyId:emailType:billingPeriod
 *
 * Recommended scheduler order (daily):
 * 1. checkAccountLifecycle
 * 2. queueBillingReminders
 * 3. sendLifecycleEmails
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function daysUntilDate(targetDate) {
  return Math.ceil((new Date(targetDate).getTime() - Date.now()) / DAY_MS);
}

function daysUntilNextFirst() {
  const now = new Date();
  const nextFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((nextFirst.getTime() - now.getTime()) / DAY_MS);
}

// Format YYYY-MM for the upcoming billing month (the 1st that Mercado Pago will charge)
function getUpcomingBillingPeriod() {
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

// Format YYYY-MM for a given date
function toYYYYMM(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function queueEmailWithKey(base44, { family_id, email_type, recipient_email, billing_period, metadata }) {
  const notification_key = billing_period
    ? `${family_id}:${email_type}:${billing_period}`
    : `${family_id}:${email_type}`;

  // Check for existing record with this key
  const existing = await base44.asServiceRole.entities.EmailNotification.filter({ notification_key });
  const alreadyHandled = existing.some(e => e.status === 'sent' || e.status === 'pending');
  if (alreadyHandled) return false;

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
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const denied = await guardInternal(base44, req);
    if (denied) return denied;
    const nowISO = new Date().toISOString();
    const stats = {
      trial_reminders_queued: 0,
      renewal_reminders_queued: 0,
      errors: [],
    };

    const getAdminEmail = async (familyId) => {
      const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        family_id: familyId,
        role: 'admin',
        status: 'approved',
      });
      return memberships[0]?.user_email ?? null;
    };

    // ── 1. Trial expiry reminders (3d, 2d, 1d before trial_end_at) ──────────
    const trialFamilies = await base44.asServiceRole.entities.Family.filter({ billing_status: 'trial' });

    for (const family of trialFamilies) {
      if (!family.trial_end_at) continue;
      try {
        const adminEmail = await getAdminEmail(family.id);
        if (!adminEmail) continue;

        const daysLeft = daysUntilDate(family.trial_end_at);
        const trialPeriod = toYYYYMM(family.trial_end_at);
        const meta = {
          app_name: 'FlowFin',
          family_name: family.name,
          days_left: daysLeft,
          trial_end_at: family.trial_end_at,
        };

        if (daysLeft === 3) {
          const queued = await queueEmailWithKey(base44, {
            family_id: family.id, email_type: 'trial_expiry_reminder_3d',
            recipient_email: adminEmail, billing_period: trialPeriod, metadata: meta,
          });
          if (queued) stats.trial_reminders_queued++;
        }
        if (daysLeft === 2) {
          const queued = await queueEmailWithKey(base44, {
            family_id: family.id, email_type: 'trial_expiry_reminder_2d',
            recipient_email: adminEmail, billing_period: trialPeriod, metadata: meta,
          });
          if (queued) stats.trial_reminders_queued++;
        }
        if (daysLeft === 1) {
          const queued = await queueEmailWithKey(base44, {
            family_id: family.id, email_type: 'trial_expiry_reminder_1d',
            recipient_email: adminEmail, billing_period: trialPeriod, metadata: meta,
          });
          if (queued) stats.trial_reminders_queued++;
        }
      } catch (err) {
        stats.errors.push(`trial:${family.id}: ${getErrorMessage(err)}`);
      }
    }

    // ── 2. Mercado Pago renewal reminders (3d, 2d, 1d before next 1st) ──────
    // Only for active families with auto_renewal=true (Mercado Pago subscription active)
    // FlowFin does NOT renew here — only reminds the customer that MP will charge
    // and that ACACIA will manually validate and confirm the license.
    const daysToFirst = daysUntilNextFirst();
    const upcomingPeriod = getUpcomingBillingPeriod();

    if (daysToFirst <= 3) {
      const activeFamilies = await base44.asServiceRole.entities.Family.filter({
        billing_status: 'active',
        auto_renewal: true,
      });

      for (const family of activeFamilies) {
        try {
          const adminEmail = await getAdminEmail(family.id);
          if (!adminEmail) continue;

          const meta = {
            app_name: 'FlowFin',
            family_name: family.name,
            days_to_first: daysToFirst,
            billing_period: upcomingPeriod,
            plan_name: family.license_plan === 'family_plus' ? 'FlowFin Family+' : 'FlowFin Home',
          };

          let emailType = null;
          if (daysToFirst === 3) emailType = 'renewal_reminder_3d';
          else if (daysToFirst === 2) emailType = 'renewal_reminder_2d';
          else if (daysToFirst === 1) emailType = 'renewal_reminder_1d';

          if (emailType) {
            const queued = await queueEmailWithKey(base44, {
              family_id: family.id, email_type: emailType,
              recipient_email: adminEmail, billing_period: upcomingPeriod, metadata: meta,
            });
            if (queued) stats.renewal_reminders_queued++;
          }
        } catch (err) {
          stats.errors.push(`renewal:${family.id}: ${getErrorMessage(err)}`);
        }
      }
    }

    console.log('[queueBillingReminders]', JSON.stringify({ ...stats, daysToFirst, timestamp: nowISO }));
    return Response.json({ success: true, ...stats, days_to_first: daysToFirst, timestamp: nowISO });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[queueBillingReminders] Fatal error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
});