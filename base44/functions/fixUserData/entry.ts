import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// This function fixes the nested data.data.family_id issue for a user
// by reading the raw stored data and writing back the flattened version
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user_id, family_id } = await req.json();
    if (!user_id || !family_id) {
      return Response.json({ error: 'user_id and family_id required' }, { status: 400 });
    }

    // Read the raw user record via the service-role SDK. The SDK manages
    // privileged credentials internally, so we never touch the service role
    // key from the function's environment.
    const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
    const rawUser = users?.[0];

    if (!rawUser) {
      // Fallback: just force-write via SDK with the correct structure
      await base44.asServiceRole.entities.User.update(user_id, {
        data: { role: 'user', family_id }
      });
      return Response.json({ success: true, method: 'sdk_fallback' });
    }

    // Build correct flat data
    const currentData = rawUser.data || {};
    // Unwrap nested .data if present
    const innerData = currentData.data || {};
    const flatData = {
      role: currentData.role || innerData.role || 'user',
      family_id,
    };
    // Copy any other keys except nested 'data'
    Object.keys(currentData).forEach(k => {
      if (k !== 'data' && k !== 'role' && k !== 'family_id') {
        flatData[k] = currentData[k];
      }
    });

    // Write back via SDK
    await base44.asServiceRole.entities.User.update(user_id, { data: flatData });

    return Response.json({ success: true, flatData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});