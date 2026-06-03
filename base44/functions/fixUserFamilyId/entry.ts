import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Admin-only utility: fixes users whose data.family_id got nested incorrectly
// Uses direct REST PUT to avoid SDK deep-merge bug
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { user_id, family_id: override_family_id } = await req.json();
    if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 });

    // Fetch user via serviceRole
    const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
    const rawUser = users?.[0];
    if (!rawUser) return Response.json({ error: 'User not found' }, { status: 404 });

    const d = rawUser.data || {};

    // Extract family_id from wherever it ended up (any nesting level)
    const family_id = override_family_id
      || d.family_id
      || d.data?.family_id
      || d.data?.data?.family_id;

    if (!family_id) {
      return Response.json({ error: 'No family_id found for this user', raw: d }, { status: 400 });
    }

    // Write via the service-role SDK. The SDK manages privileged credentials
    // internally, so we never forward the caller's api_key (or any raw key) in
    // an outbound request header.
    await base44.asServiceRole.entities.User.update(user_id, {
      data: { family_id }
    });

    // Verify
    const updated = await base44.asServiceRole.entities.User.filter({ id: user_id });
    const newData = updated?.[0]?.data;

    return Response.json({ success: true, fixed: { family_id }, newData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
});
