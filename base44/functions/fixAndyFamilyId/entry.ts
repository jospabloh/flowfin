import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const appId = Deno.env.get('BASE44_APP_ID');
    const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';

    // Update Andy using the API with full data replacement
    const response = await fetch(
      `https://api.base44.com/api/apps/${appId}/entities/User/69c40ee765cf8b828ad12a8d`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            family_id: '69c40e9a8ea547f19057c84c',
          },
        }),
      }
    );

    const result = await response.json();
    
    if (!response.ok) {
      return Response.json({ error: 'API error', details: result }, { status: 500 });
    }

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});