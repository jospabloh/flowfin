import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Only admins can fix user data
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const appId = Deno.env.get('BASE44_APP_ID');
    
    // Get Andy's user record directly
    const res = await fetch(
      `https://api.base44.com/api/apps/${appId}/entities/User/69c40ee765cf8b828ad12a8d`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': user.api_key || '',
        },
      }
    );

    if (!res.ok) {
      return Response.json({ error: 'Failed to fetch user' }, { status: 500 });
    }

    const userData = await res.json();
    
    // Fix the nested structure
    const correctedData = {
      role: userData.data?.role || 'user',
      family_id: '69c40e9a8ea547f19057c84c',
    };

    // Update with corrected data
    const updateRes = await fetch(
      `https://api.base44.com/api/apps/${appId}/entities/User/69c40ee765cf8b828ad12a8d`,
      {
        method: 'PUT',
        headers: {
          'X-API-Key': user.api_key || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: correctedData }),
      }
    );

    if (!updateRes.ok) {
      return Response.json({ error: 'Failed to update user' }, { status: 500 });
    }

    const updated = await updateRes.json();
    return Response.json({ success: true, data: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});