import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { decideSwitchFamily } from './switchFamilyLogic.ts';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { family_id } = await req.json();

    // Re-derive the caller's memberships from scratch — never trust a
    // client-sent candidate list (acacia-app-standard STANDARD.md §18,
    // point 2). Same user_id -> user_email fallback used by every other
    // handler in this directory (e.g. getMyMembership.ts).
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_id: user.id });
    if (!memberships.length) {
      memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_email: user.email });
    }

    const decision = decideSwitchFamily(memberships, family_id);
    if (!decision.allowed) {
      return Response.json({ error: 'No perteneces a esa familia' }, { status: 403 });
    }

    // User.data.family_id is write-locked to admin/server-only
    // (base44/entities/User.jsonc) — this asServiceRole write is one of its
    // sanctioned writers, alongside selfJoin/approveMember/createFamily/
    // removeMember/setUserFamilyId/fixUserFamilyId. Mirrors the
    // spread-then-delete-nested-data pattern selfJoin.ts and removeMember.ts
    // already use, guarding against the historical data.data double-nesting
    // some User rows carry.
    const userData = { ...(user.data || {}), family_id };
    delete userData.data;
    await base44.asServiceRole.entities.User.update(user.id, { data: userData });

    // Keep last_active_at current on the newly active membership so
    // guardedEntityWrite's resolveFamilyAccess (which falls back to the
    // most-recently-active membership when nothing persisted matches)
    // agrees with this switch going forward.
    const target = memberships.find((m) => m.status === 'approved' && m.family_id === family_id);
    if (target) {
      await base44.asServiceRole.entities.FamilyMembership.update(target.id, {
        last_active_at: new Date().toISOString(),
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
