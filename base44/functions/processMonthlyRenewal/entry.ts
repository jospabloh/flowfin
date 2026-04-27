import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Scheduled function: runs on the 1st of each month.
// For active families with auto_renewal=true, extends license_expires_at by 1 month
// and queues a renewal_confirmed email.
// Also queues renewal_upcoming reminders ~5 days before the next 1st for all auto-renewal families.

const DAY_MS = 24 * 60 * 60 * 1000;

function addOneMonth(isoDate: string): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function daysUntilNextFirst(): number {
  const now = new Date();
  const nextFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((nextFirst.getTime() - now.getTime()) / DAY_MS);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const nowISO = now.toISOString();

    const stats = { renewed: 0, upcoming_queued: 0, errors: [] as string[] };

    async function getAdminEmail(familyId: string): Promise<string | null> {
      const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        family_id: familyId,
        role: 'admin',
        status: 'approved',
      });
      return memberships[0]?.user_email ?? null;
    }

    async function queueEmail(family_id: string, email_type: string, recipient_email: string) {
      const existing = await base44.asServiceRole.entities.EmailNotification.filter({
        family_id,
        email_type,
      });
      const alreadyHandled = existing.some((e: { status?: string }) => e.status === 'sent' || e.status === 'pending');
      if (alreadyHandled) return;

      await base44.asServiceRole.entities.EmailNotification.create({
        family_id,
        email_type,
        recipient_email,
        status: 'pending',
        retry_count: 0,
      });
    }

    const autoRenewalFamilies = await base44.asServiceRole.entities.Family.filter({
      billing_status: 'active',
      auto_renewal: true,
    });

    const daysToFirst = daysUntilNextFirst();
    const isFirstOfMonth = now.getDate() === 1;

    for (const family of autoRenewalFamilies) {
      try {
        const adminEmail = await getAdminEmail(family.id);
        if (!adminEmail) continue;

        // On the 1st of the month: renew families whose license_expires_at is reached or has passed
        if (isFirstOfMonth && family.license_expires_at) {
          const expiresAt = new Date(family.license_expires_at);
          if (expiresAt <= now) {
            const newExpiry = addOneMonth(family.license_expires_at);
            await base44.asServiceRole.entities.Family.update(family.id, {
              license_expires_at: newExpiry,
              license_activated_at: nowISO,
            });
            await queueEmail(family.id, 'renewal_confirmed', adminEmail);
            stats.renewed++;
          }
        }

        // Queue renewal_upcoming ~5 days before the next 1st
        if (daysToFirst <= 5) {
          await queueEmail(family.id, 'renewal_upcoming', adminEmail);
          stats.upcoming_queued++;
        }
      } catch (err: unknown) {
        stats.errors.push(`${family.id}: ${getErrorMessage(err)}`);
      }
    }

    console.log('[processMonthlyRenewal]', JSON.stringify({ ...stats, timestamp: nowISO }));
    return Response.json({ success: true, ...stats, timestamp: nowISO });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error('[processMonthlyRenewal] Fatal error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
});
