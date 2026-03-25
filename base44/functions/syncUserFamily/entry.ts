import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get approved membership
    let membership = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });
    
    if (!membership.length) {
      membership = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: user.email,
        status: 'approved',
      });
    }

    if (!membership.length) {
      return Response.json({ error: 'No approved membership found' }, { status: 404 });
    }

    const familyId = membership[0].family_id;
    const currentFamilyId = user.data?.family_id;

    // Only update if different
    if (currentFamilyId !== familyId) {
      await base44.auth.updateMe({ family_id: familyId });
    }

    return Response.json({ success: true, family_id: familyId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});