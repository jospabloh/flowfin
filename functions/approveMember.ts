import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { membership_id, family_id, target_user_id } = await req.json();

    // Verify caller is app admin OR family admin
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

    // Update membership status
    await base44.asServiceRole.entities.FamilyMembership.update(membership_id, { status: 'approved' });

    // Update family_id inside user's data object
    const users = await base44.asServiceRole.entities.User.filter({ id: target_user_id });
    if (users && users[0]) {
      const existing = users[0].data || {};
      const newData = { ...existing, family_id };
      delete newData.data;
      await base44.asServiceRole.entities.User.update(target_user_id, { data: newData });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});