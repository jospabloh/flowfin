import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { membership_id, target_user_id } = await req.json();

    // Delete the membership
    await base44.asServiceRole.entities.FamilyMembership.delete(membership_id);

    // Clear family_id from the user record
    await base44.asServiceRole.entities.User.update(target_user_id, { family_id: null });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});