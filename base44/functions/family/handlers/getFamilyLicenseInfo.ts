import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Server-side family license resolver
 * Returns normalized license state for the authenticated user's family.
 * Enforces that user can only access their own family's license info.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get membership directly (avoid nested function call that causes auth issues)
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });
    if (!memberships.length) {
      memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: user.email,
        status: 'approved',
      });
    }
    const membership = memberships[0] || null;

    let family = null;
    if (membership?.family_id) {
      const families = await base44.asServiceRole.entities.Family.filter({ id: membership.family_id });
      family = families[0] || null;
    }

    if (!family || !membership) {
      return Response.json({ error: 'No family found' }, { status: 404 });
    }

    // Normalize billing status (grandfather clause: default to 'active')
    const billingStatus = family.billing_status || 'active';
    const now = new Date();

    // Calculate trial days left (only for trial status)
    let trialDaysLeft = null;
    if (billingStatus === 'trial' && family.trial_end_at) {
      const diff = new Date(family.trial_end_at) - now;
      trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    // Determine read-only enforcement (archived also blocks all writes)
    const isReadOnly = billingStatus === 'view_only' || billingStatus === 'suspended' || billingStatus === 'archived';

    // Get active member count
    let activeMemberCount = 0;
    try {
      const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        family_id: family.id,
        status: 'approved',
      });
      activeMemberCount = memberships.length;
    } catch {
      activeMemberCount = 0;
    }

    return Response.json({
      success: true,
      familyId: family.id,
      billingStatus,
      isReadOnly,
      licensePlan: family.license_plan || 'home',
      licensedMemberLimit: family.licensed_member_limit || 4,
      activeMemberCount,
      trialDaysLeft,
      trialStartAt: family.trial_start_at || null,
      trialEndAt: family.trial_end_at || null,
      licenseActivatedAt: family.license_activated_at || null,
      licenseExpiresAt: family.license_expires_at || null,
      autoRenewal: family.auto_renewal || false,
      archivedAt: family.archived_at || null,
      scheduledDeleteAt: family.scheduled_delete_at || null,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[getFamilyLicenseInfo] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}