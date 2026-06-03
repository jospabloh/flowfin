import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { family_id } = await req.json();
    if (!family_id) return Response.json({ family: null });

    // Authorization: a caller may only read a family they belong to. Without
    // this check, any authenticated user could pass an arbitrary family_id and
    // read another family's record through the service-role client below.
    const isAdmin = user.role === 'admin';
    const ownFamilyId = user?.data?.family_id || user?.data?.data?.family_id;

    let authorized = isAdmin || family_id === ownFamilyId;
    if (!authorized) {
      const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_id: user.id,
        family_id,
        status: 'approved',
      });
      authorized = memberships.length > 0;
    }

    if (!authorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const families = await base44.asServiceRole.entities.Family.filter({ id: family_id });
    return Response.json({ family: families[0] || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});