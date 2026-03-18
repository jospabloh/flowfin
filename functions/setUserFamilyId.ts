import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { target_user_id, family_id } = await req.json();

    // Set family_id directly — never spread existing data to avoid nested corruption
    await base44.asServiceRole.entities.User.update(target_user_id, {
      data: { family_id, admin_family_ids: null }
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});