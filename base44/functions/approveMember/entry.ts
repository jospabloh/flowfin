import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { membership_id, family_id, target_user_id } = await req.json();

    if (!membership_id || !family_id || !target_user_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

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

    // Verify the membership_id actually belongs to the claimed family_id
    // This prevents a caller from approving memberships of other families
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ id: membership_id });
    const targetMembership = memberships?.[0];
    if (!targetMembership || targetMembership.family_id !== family_id) {
      return Response.json({ error: 'Forbidden: membership does not belong to this family' }, { status: 403 });
    }

    // Update membership status
    await base44.asServiceRole.entities.FamilyMembership.update(membership_id, { status: 'approved' });

    // Update family_id inside user's data object
    const users = await base44.asServiceRole.entities.User.filter({ id: target_user_id });
    if (users && users[0]) {
      const targetUser = users[0];
      // The SDK wraps entity fields under .data, but User entity exposes fields directly
      // We need to read the actual stored data field and set family_id correctly
      const currentData = targetUser.data || {};
      // Strip any accidentally nested .data key
      const { data: _nested, ...cleanData } = currentData;
      const newData = { ...cleanData, family_id };
      await base44.asServiceRole.entities.User.update(target_user_id, { data: newData });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});