import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { membership_id, target_user_id } = await req.json();

    // Get the membership to find the family_id for authorization check
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ id: membership_id });
    const membership = memberships[0];
    if (!membership) return Response.json({ error: 'Membership not found' }, { status: 404 });

    // Verify caller is app admin OR family admin
    if (user.role !== 'admin') {
      const callerMemberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        family_id: membership.family_id,
        user_id: user.id,
        role: 'admin',
        status: 'approved',
      });
      if (!callerMemberships.length) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    await base44.asServiceRole.entities.FamilyMembership.delete(membership_id);

    // target_user_id is client-supplied and must never be trusted on its own:
    // it must match the user_id of the membership we just verified belongs to
    // this family, or a caller could null out family_id on an arbitrary user
    // of ANY family by passing the membership_id they're entitled to delete
    // alongside an unrelated target_user_id (module 14 multi-tenant isolation
    // audit, 2026-08-23 — finding #3).
    if (target_user_id && target_user_id === membership.user_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: target_user_id });
      if (users && users[0]) {
        const newData = { ...(users[0].data || {}), family_id: null };
        delete newData.data;
        await base44.asServiceRole.entities.User.update(target_user_id, { data: newData });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}