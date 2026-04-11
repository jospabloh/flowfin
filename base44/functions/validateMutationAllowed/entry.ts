import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Server-side mutation guard.
 * Call before any create/update/delete to enforce read-only mode.
 * Returns error response if mutation should be blocked.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // System admins always allowed
    if (user.role === 'admin') {
      return Response.json({ allowed: true });
    }

    // Get family license info
    const membershipRes = await base44.functions.invoke('getMyMembership', {});
    const { family } = membershipRes.data || {};

    if (!family) {
      return Response.json({ error: 'No family found' }, { status: 404 });
    }

    const billingStatus = family.billing_status || 'active';

    // Block mutations in read-only status
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({
        allowed: false,
        reason: 'read_only',
        billingStatus,
      });
    }

    // Allow mutations for active and trial
    return Response.json({ allowed: true });
  } catch (error) {
    console.error('[validateMutationAllowed] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});