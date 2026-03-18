import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Use service role to bypass RLS and token caching issues
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });
    const membership = memberships[0] || null;
    if (!membership) return Response.json({ membership: null, family: null });

    const families = await base44.asServiceRole.entities.Family.filter({ id: membership.family_id });
    const family = families[0] || null;

    return Response.json({ membership, family });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});