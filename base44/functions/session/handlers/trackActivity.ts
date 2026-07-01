import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * trackActivity — Updates last_active_at on the user's FamilyMembership.
 * Server-side guard: skips update if last_active_at is less than 30 min ago.
 * This prevents rate-limit storms even if the frontend fires multiple times.
 */

const SERVER_THROTTLE_MS = 30 * 60 * 1000; // 30 minutes

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
    }

    // Find the user's approved membership (service role to reduce latency)
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) {
      memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    }

    if (!memberships.length) {
      return Response.json({ ok: false, reason: 'no_membership' });
    }

    const membership = memberships[0];
    const nowISO = new Date().toISOString();

    // Server-side throttle: skip if updated recently
    if (membership.last_active_at) {
      const elapsed = Date.now() - new Date(membership.last_active_at).getTime();
      if (elapsed < SERVER_THROTTLE_MS) {
        return Response.json({ ok: true, skipped: true, last_active_at: membership.last_active_at });
      }
    }

    await base44.asServiceRole.entities.FamilyMembership.update(membership.id, { last_active_at: nowISO });

    return Response.json({ ok: true, last_active_at: nowISO });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[trackActivity] error:', msg);
    // Return 200 so the frontend never crashes on this
    return Response.json({ ok: false, reason: msg });
  }
}