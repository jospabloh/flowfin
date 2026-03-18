import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { family_id } = await req.json();
    if (!family_id) return Response.json({ family: null });

    const families = await base44.asServiceRole.entities.Family.filter({ id: family_id });
    return Response.json({ family: families[0] || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});