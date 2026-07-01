import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { membership_id, person_id, family_id } = await req.json();

    if (!membership_id || !family_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify caller is a family admin
    if (user.role !== 'admin') {
      const callerMemberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        family_id,
        user_id: user.id,
        role: 'admin',
        status: 'approved',
      });
      if (!callerMemberships.length) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Verify the target membership belongs to this family
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ id: membership_id });
    const target = memberships?.[0];
    if (!target || target.family_id !== family_id) {
      return Response.json({ error: 'Membership not found in this family' }, { status: 404 });
    }

    // Update person_id using service role to bypass RLS
    await base44.asServiceRole.entities.FamilyMembership.update(membership_id, {
      person_id: person_id || null,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
