import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { membership_id, family_id, target_user_id } = await req.json();

    // Update membership status
    await base44.asServiceRole.entities.FamilyMembership.update(membership_id, { status: 'approved' });

    // Update family_id inside user's data object
    const users = await base44.asServiceRole.entities.User.filter({ id: target_user_id });
    if (users && users[0]) {
      const newData = { ...(users[0].data || {}), family_id };
      await base44.asServiceRole.entities.User.update(target_user_id, { data: newData });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});