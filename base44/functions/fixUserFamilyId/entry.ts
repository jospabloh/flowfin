import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Admin-only utility: fixes users whose data.family_id got nested incorrectly
// by reading via serviceRole and writing back the flat structure
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { user_id, family_id: override_family_id } = await req.json();
    if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 });

    // Fetch users via serviceRole SDK (has full access)
    const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
    const rawUser = users?.[0];
    if (!rawUser) return Response.json({ error: 'User not found' }, { status: 404 });

    const d = rawUser.data || {};

    // Use override if provided, else extract from wherever it ended up due to SDK deep-merge
    const family_id = override_family_id || d.family_id || d.data?.family_id || d.data?.data?.family_id;
    const role = d.role || d.data?.role || 'user';

    if (!family_id) {
      return Response.json({ error: 'No family_id found for this user', raw: d }, { status: 400 });
    }

    // The update_entities tool writes flat — use it via SDK serviceRole
    // We write role + family_id only (no nested data key)
    await base44.asServiceRole.entities.User.update(user_id, {
      data: { role, family_id }
    });

    // Verify it was written correctly
    const updated = await base44.asServiceRole.entities.User.filter({ id: user_id });
    const newData = updated?.[0]?.data;

    return Response.json({ success: true, fixed: { role, family_id }, newData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});