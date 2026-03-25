import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Only admins can fix user data
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update Andy's family_id using service role
    const result = await base44.asServiceRole.entities.User.update('69c40ee765cf8b828ad12a8d', {
      data: {
        family_id: '69c40e9a8ea547f19057c84c',
      },
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});