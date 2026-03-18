import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { membership_id, family_id, target_user_id } = await req.json();

    // Update membership status
    await base44.asServiceRole.entities.FamilyMembership.update(membership_id, { status: 'approved' });

    // Set family_id directly — do NOT spread existing data to avoid nested corruption
    await base44.asServiceRole.entities.User.update(target_user_id, {
      data: { family_id, admin_family_ids: null }
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});