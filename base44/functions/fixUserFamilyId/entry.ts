import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Admin-only utility: fixes a user's data.family_id to be at the correct flat level
// using direct REST API to bypass the SDK's deep-merge behavior
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { user_id } = await req.json();
    if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 });

    const appId = Deno.env.get('BASE44_APP_ID');
    const apiBase = `https://api.base44.com/api/apps/${appId}`;

    // Get raw user record
    const getRes = await fetch(`${apiBase}/entities/User/${user_id}`, {
      headers: { 'X-User-Token': caller.api_key || '', 'Content-Type': 'application/json' },
    });

    if (!getRes.ok) {
      return Response.json({ error: 'Could not fetch user' }, { status: 500 });
    }

    const rawUser = await getRes.json();
    const d = rawUser.data || {};

    // Extract family_id from wherever it ended up (flat or nested)
    const family_id = d.family_id || d.data?.family_id || d.data?.data?.family_id;
    const role = d.role || d.data?.role || 'user';

    if (!family_id) {
      return Response.json({ error: 'No family_id found for this user', raw: d }, { status: 400 });
    }

    // Write back flat using SDK update (the tool-level update_entities writes flat)
    await base44.asServiceRole.entities.User.update(user_id, {
      data: { role, family_id }
    });

    return Response.json({ success: true, fixed: { role, family_id } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});