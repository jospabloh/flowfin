import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * trackActivity — Updates last_active_at on the user's FamilyMembership.
 * Called from the frontend with throttling (max once per 20 min per session).
 * Safe: never throws UI-blocking errors.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
    }

    const nowISO = new Date().toISOString();

    // Find the user's approved membership
    let memberships = await base44.entities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) {
      memberships = await base44.entities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    }

    if (!memberships.length) {
      return Response.json({ ok: false, reason: 'no_membership' });
    }

    const membership = memberships[0];
    await base44.entities.FamilyMembership.update(membership.id, { last_active_at: nowISO });

    return Response.json({ ok: true, last_active_at: nowISO });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[trackActivity] error:', msg);
    // Return 200 so the frontend never crashes on this
    return Response.json({ ok: false, reason: msg });
  }
});