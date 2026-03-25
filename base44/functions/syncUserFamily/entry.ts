import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get approved membership by user_id
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });
    
    // Fallback to user_email
    if (!memberships.length) {
      memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: user.email,
        status: 'approved',
      });
    }

    if (!memberships.length) {
      return Response.json({ error: 'No approved membership found' }, { status: 404 });
    }

    const membership = memberships[0];
    const currentFamilyId = user.data?.family_id;

    // Update if different (use direct REST PUT to avoid deep-merge issues)
    if (currentFamilyId !== membership.family_id) {
      const appId = Deno.env.get('BASE44_APP_ID');
      await fetch(`https://api.base44.com/api/apps/${appId}/entities/User/${user.id}`, {
        method: 'PUT',
        headers: {
          'X-API-Key': user.api_key || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: { family_id: membership.family_id } }),
      }).catch(() => {
        // Fallback to SDK if REST fails
        return base44.auth.updateMe({ family_id: membership.family_id });
      });
    }

    return Response.json({ success: true, family_id: membership.family_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});