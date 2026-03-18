import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { membership_id, target_user_id, skip_membership } = await req.json();

    // Delete the membership (unless skip_membership flag is set for cleanup)
    if (!skip_membership && membership_id) {
      await base44.asServiceRole.entities.FamilyMembership.delete(membership_id);
    }

    // Clear family_id from the user's data object using updateMe-style service role update
    if (target_user_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: target_user_id });
      if (users && users[0]) {
        const u = users[0];
        const newData = { ...(u.data || {}), family_id: null };
        await base44.asServiceRole.entities.User.update(target_user_id, { data: newData });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});