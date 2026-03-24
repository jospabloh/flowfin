import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Strict admin-only check at top-level before any other logic
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const { target_user_id, family_id } = await req.json();

    if (!target_user_id || !family_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Update family_id as a top-level field on the user record (not nested under data)
    await base44.asServiceRole.entities.User.update(target_user_id, { family_id });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});