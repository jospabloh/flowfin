import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { guardInternal } from '../_internalGuard.ts';

/**
 * processMonthlyRenewal — REFACTORED (no longer auto-extends licenses)
 *
 * FlowFin does NOT automatically renew licenses internally.
 * Mercado Pago handles external billing. ACACIA / Pablo manually verifies
 * payment and confirms it via confirmLicensePayment function.
 *
 * This function now only queues the renewal_upcoming reminder for families
 * with auto_renewal=true when we are within 5 days of the 1st.
 * The actual 3d/2d/1d reminders are handled by queueBillingReminders (daily).
 *
 * Previously this function auto-extended license_expires_at on the 1st of the month.
 * That behavior has been REMOVED. Payment confirmation is MANUAL through confirmLicensePayment.
 *
 * Scheduler: can remain monthly or daily — it only queues reminders, never modifies licenses.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function daysUntilNextFirst() {
  const now = new Date();
  const nextFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((nextFirst.getTime() - now.getTime()) / DAY_MS);
}

function getUpcomingBillingPeriod() {
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const denied = await guardInternal(base44, req);
    if (denied) return denied;
    const nowISO = new Date().toISOString();
    const stats = { upcoming_queued: 0, errors: [] };

    const getAdminEmail = async (familyId) => {
      const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        family_id: familyId,
        role: 'admin',
        status: 'approved',
      });
      return memberships[0]?.user_email ?? null;
    };

    const queueEmail = async (family_id, email_type, recipient_email, billing_period) => {
      const notification_key = billing_period
        ? `${family_id}:${email_type}:${billing_period}`
        : `${family_id}:${email_type}`;

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
        scheduled_for: nowISO,
      });
      return true;
    };

    // NOTE: FlowFin does NOT auto-renew licenses. The former auto-extension code
    // (which set license_expires_at = addOneMonth on the 1st) has been removed.
    // Payment confirmation is MANUAL through the confirmLicensePayment function.

    const autoRenewalFamilies = await base44.asServiceRole.entities.Family.filter({
      billing_status: 'active',
      auto_renewal: true,
    });

    const daysToFirst = daysUntilNextFirst();
    const upcomingPeriod = getUpcomingBillingPeriod();

    // Queue renewal_upcoming within 5 days of the 1st (general FYI reminder)
    if (daysToFirst <= 5) {
      for (const family of autoRenewalFamilies) {
        try {
          const adminEmail = await getAdminEmail(family.id);
          if (!adminEmail) continue;

          const queued = await queueEmail(family.id, 'renewal_upcoming', adminEmail, upcomingPeriod);
          if (queued) stats.upcoming_queued++;
        } catch (err) {
          stats.errors.push(`${family.id}: ${getErrorMessage(err)}`);
        }
      }
    }

    console.log('[processMonthlyRenewal] No auto-renewal. Reminders only.', JSON.stringify({ ...stats, timestamp: nowISO }));
    return Response.json({ success: true, ...stats, timestamp: nowISO });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[processMonthlyRenewal] Fatal error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
});