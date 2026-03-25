import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Try by user_id first, fallback to user_email
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });

    if (!memberships.length) {
      memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: user.email,
        status: 'approved',
      });
    }

    const membership = memberships[0] || null;
    if (!membership) return Response.json({ membership: null, family: null });

    const families = await base44.asServiceRole.entities.Family.filter({ id: membership.family_id });
    const family = families[0] || null;

    // Auto-fix: if user.data.family_id is missing or wrong, self-heal using direct REST PUT
    // IMPORTANT: use REST PUT (not SDK) to avoid deep-merge nesting bug
    const currentFamilyId = user.data?.family_id || user.data?.data?.family_id;
    if (currentFamilyId !== membership.family_id || user.data?.family_role !== membership.role) {
      const appId = Deno.env.get('BASE44_APP_ID');
      await fetch(`https://api.base44.com/api/apps/${appId}/entities/User/${user.id}`, {
        method: 'PUT',
        headers: {
          'X-API-Key': user.api_key || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: { family_id: membership.family_id, family_role: membership.role } }),
      });
    }

    // Fetch FamilyConfig via service role so ALL members get it regardless of RLS
    const configs = await base44.asServiceRole.entities.FamilyConfig.filter({ family_id: membership.family_id });
    const familyConfig = configs[0] || null;

    return Response.json({ membership, family, familyConfig });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});