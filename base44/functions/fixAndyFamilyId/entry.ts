import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Only admins can fix user data
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get current Andy data
    const currentAndyData = await base44.asServiceRole.entities.User.filter({
      email: 'andyramirez005@gmail.com',
    });

    if (!currentAndyData.length) {
      return Response.json({ error: 'Andy not found' }, { status: 404 });
    }

    const andy = currentAndyData[0];
    const andyId = andy.id;

    // Flatten the nested structure - rebuild data cleanly
    const cleanData = {
      family_id: '69c40e9a8ea547f19057c84c',
    };

    // Update with clean structure
    const result = await base44.asServiceRole.entities.User.update(andyId, {
      data: cleanData,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});