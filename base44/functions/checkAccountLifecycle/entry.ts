import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Daily scheduled function: manages all account lifecycle state transitions and
// queues EmailNotification records for sendLifecycleEmails to deliver.
// Decoupled from email delivery so a failed send never blocks a status transition.

const DAY_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const nowISO = now.toISOString();

    const stats = {
      trial_notifications_queued: 0,
      trial_to_view_only: 0,
      view_only_to_archived: 0,
      archived_deleted: 0,
      license_notifications_queued: 0,
      grace_to_view_only: 0,
      errors: [] as string[],
    };

    const getAdminEmail = async (familyId: string): Promise<string | null> => {
      const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        family_id: familyId,
        role: 'admin',
        status: 'approved',
      });
      return memberships[0]?.user_email ?? null;
    };

    // Idempotent: creates an EmailNotification only if no pending/sent record exists for this family+type
    const queueEmail = async (family_id: string, email_type: string, recipient_email: string) => {
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
    };

    // ── A: Trial families ─────────────────────────────────────────────────────
    const trialFamilies = await base44.asServiceRole.entities.Family.filter({ billing_status: 'trial' });

    for (const family of trialFamilies) {
      try {
        if (!family.trial_start_at) continue;
        const adminEmail = await getAdminEmail(family.id);
        if (!adminEmail) continue;

        const trialStart = new Date(family.trial_start_at);
        const daysSinceStart = Math.floor((now.getTime() - trialStart.getTime()) / DAY_MS);

        if (daysSinceStart >= 20) {
          await queueEmail(family.id, 'trial_day20', adminEmail);
          stats.trial_notifications_queued++;
        }
        if (daysSinceStart >= 27) {
          await queueEmail(family.id, 'trial_day27', adminEmail);
          stats.trial_notifications_queued++;
        }
        if (daysSinceStart >= 29) {
          await queueEmail(family.id, 'trial_day29', adminEmail);
          stats.trial_notifications_queued++;
        }

        if (family.trial_end_at && family.trial_end_at <= nowISO) {
          await base44.asServiceRole.entities.Family.update(family.id, {
            billing_status: 'view_only',
            view_only_since: nowISO,
          });
          await queueEmail(family.id, 'trial_ended', adminEmail);
          stats.trial_to_view_only++;
        }
      } catch (err: unknown) {
        stats.errors.push(`trial:${family.id}: ${getErrorMessage(err)}`);
      }
    }

    // ── B: view_only → archived (15 days) ────────────────────────────────────
    const viewOnlyFamilies = await base44.asServiceRole.entities.Family.filter({ billing_status: 'view_only' });

    for (const family of viewOnlyFamilies) {
      try {
        if (!family.view_only_since) continue; // skip families without anchor — handled by migration
        const adminEmail = await getAdminEmail(family.id);
        if (!adminEmail) continue;

        const anchor = new Date(family.view_only_since);
        const daysInViewOnly = Math.floor((now.getTime() - anchor.getTime()) / DAY_MS);

        if (daysInViewOnly >= 10) {
          await queueEmail(family.id, 'archived_warning', adminEmail);
        }

        if (daysInViewOnly >= 15) {
          const scheduledDeleteAt = new Date(now.getTime() + 30 * DAY_MS).toISOString();
          await base44.asServiceRole.entities.Family.update(family.id, {
            billing_status: 'archived',
            archived_at: nowISO,
            scheduled_delete_at: scheduledDeleteAt,
          });
          stats.view_only_to_archived++;
        }
      } catch (err: unknown) {
        stats.errors.push(`view_only:${family.id}: ${getErrorMessage(err)}`);
      }
    }

    // ── C: archived → deletion (30 days) ─────────────────────────────────────
    const archivedFamilies = await base44.asServiceRole.entities.Family.filter({ billing_status: 'archived' });

    for (const family of archivedFamilies) {
      try {
        if (!family.scheduled_delete_at) continue;
        const deleteAt = new Date(family.scheduled_delete_at);
        const daysUntilDelete = Math.ceil((deleteAt.getTime() - now.getTime()) / DAY_MS);

        if (daysUntilDelete <= 3) {
          const adminEmail = await getAdminEmail(family.id);
          if (adminEmail) await queueEmail(family.id, 'deletion_warning', adminEmail);
        }

        if (now >= deleteAt) {
          // Delete memberships first, then notifications, then the family
          const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ family_id: family.id });
          for (const m of memberships) {
            await base44.asServiceRole.entities.FamilyMembership.delete(m.id);
          }

          const notifications = await base44.asServiceRole.entities.EmailNotification.filter({ family_id: family.id });
          for (const n of notifications) {
            await base44.asServiceRole.entities.EmailNotification.delete(n.id);
          }

          await base44.asServiceRole.entities.Family.delete(family.id);
          stats.archived_deleted++;
        }
      } catch (err: unknown) {
        stats.errors.push(`archived:${family.id}: ${getErrorMessage(err)}`);
      }
    }

    // ── D: Active families with license_expires_at (manual renewal path) ─────
    const activeFamilies = await base44.asServiceRole.entities.Family.filter({ billing_status: 'active' });

    for (const family of activeFamilies) {
      try {
        if (!family.license_expires_at) continue; // perpetual or auto-renewal handles it
        if (family.auto_renewal) continue; // processMonthlyRenewal handles auto-renewal families

        const adminEmail = await getAdminEmail(family.id);
        if (!adminEmail) continue;

        const expiresAt = new Date(family.license_expires_at);
        const msDiff = expiresAt.getTime() - now.getTime();
        const daysUntilExpiry = Math.ceil(msDiff / DAY_MS);
        const daysSinceExpiry = Math.floor(-msDiff / DAY_MS);

        if (daysUntilExpiry <= 10 && daysUntilExpiry > 5) {
          await queueEmail(family.id, 'license_expiry_10d', adminEmail);
          stats.license_notifications_queued++;
        }
        if (daysUntilExpiry <= 5 && daysUntilExpiry > 1) {
          await queueEmail(family.id, 'license_expiry_5d', adminEmail);
          stats.license_notifications_queued++;
        }
        if (daysUntilExpiry <= 1 && daysUntilExpiry > 0) {
          await queueEmail(family.id, 'license_expiry_1d', adminEmail);
          stats.license_notifications_queued++;
        }
        if (daysSinceExpiry >= 0 && daysSinceExpiry < 3) {
          // Expired but within 3-day grace: send expiry + grace warning
          await queueEmail(family.id, 'license_expired', adminEmail);
          await queueEmail(family.id, 'grace_period_warning', adminEmail);
        }
        if (daysSinceExpiry >= 3) {
          // Grace period elapsed → view_only
          await base44.asServiceRole.entities.Family.update(family.id, {
            billing_status: 'view_only',
            view_only_since: nowISO,
          });
          await queueEmail(family.id, 'license_view_only', adminEmail);
          stats.grace_to_view_only++;
        }

        // Also queue renewal_upcoming for auto-renewal families ~5 days before the 1st
        // (handled in processMonthlyRenewal for auto_renewal=true, nothing here)
      } catch (err: unknown) {
        stats.errors.push(`active:${family.id}: ${getErrorMessage(err)}`);
      }
    }

    console.log('[checkAccountLifecycle]', JSON.stringify({ ...stats, timestamp: nowISO }));
    return Response.json({ success: true, ...stats, timestamp: nowISO });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error('[checkAccountLifecycle] Fatal error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
});
