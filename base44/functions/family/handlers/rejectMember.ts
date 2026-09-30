import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { canDecideOn } from './_membershipRules.ts';
import { isFamilyAdmin } from './_userMemberships.ts';

// Reject a pending join request. Before this existed the client updated the
// membership row directly, which the entity RLS only allows for the row's own
// user, so a family admin's "rechazar" could not work. Same trust model as
// approveMember: caller must be admin of the stored membership's family.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { membership_id, family_id } = await req.json();
    if (!membership_id || !family_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    if (!(await isFamilyAdmin(sr, user, family_id))) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const memberships = await sr.entities.FamilyMembership.filter({ id: membership_id });
    const decision = canDecideOn(memberships?.[0], family_id);
    if (!decision.ok) {
      return Response.json({ error: decision.error }, { status: decision.status });
    }

    await sr.entities.FamilyMembership.update(membership_id, { status: 'rejected' });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
