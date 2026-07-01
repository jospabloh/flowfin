import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { membership_id, family_id, target_user_id } = await req.json();

    if (!membership_id || !family_id || !target_user_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify caller is app admin OR family admin
    if (user.role !== 'admin') {
      const callerMemberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        family_id,
        user_id: user.id,
        role: 'admin',
        status: 'approved',
      });
      if (!callerMemberships.length) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Verify the membership actually belongs to the claimed family_id
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ id: membership_id });
    const targetMembership = memberships?.[0];
    if (!targetMembership || targetMembership.family_id !== family_id) {
      return Response.json({ error: 'Forbidden: membership does not belong to this family' }, { status: 403 });
    }

    // Fetch family to check billing status and member limit
    const familyRecords = await base44.asServiceRole.entities.Family.filter({ id: family_id });
    const currentFamily = familyRecords?.[0];
    if (currentFamily) {
      // Check member limit
      const approvedMembers = await base44.asServiceRole.entities.FamilyMembership.filter({
        family_id,
        status: 'approved',
      });
      const memberLimit = currentFamily.licensed_member_limit || 4;
      if (approvedMembers.length >= memberLimit) {
        return Response.json({
          error: `Límite de integrantes alcanzado (${memberLimit}). Actualiza tu plan para agregar más miembros.`,
          limit_reached: true,
          current_count: approvedMembers.length,
          limit: memberLimit,
        }, { status: 403 });
      }
    }

    // Update membership status
    await base44.asServiceRole.entities.FamilyMembership.update(membership_id, { status: 'approved' });

    // Fix user's family_id using direct REST API to avoid SDK deep-merge nesting bug
    const appId = Deno.env.get('BASE44_APP_ID');
    const apiBase = `https://api.base44.com/api/apps/${appId}`;

    // Get the current raw user data first
    const getRes = await fetch(`${apiBase}/entities/User/${target_user_id}`, {
      headers: { 'X-User-Token': user.api_key || '', 'Content-Type': 'application/json' },
    });

    // Build flat data payload — role preserved, family_id at correct level
    let currentRole = 'user';
    if (getRes.ok) {
      const rawUser = await getRes.json();
      // Dig out role regardless of nesting
      currentRole = rawUser.data?.role || rawUser.data?.data?.role || 'user';
    }

    // Use REST PATCH directly to write the full data object as a flat replace
    const patchRes = await fetch(`${apiBase}/entities/User/${target_user_id}`, {
      method: 'PUT',
      headers: { 'X-User-Token': user.api_key || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { role: currentRole, family_id } }),
    });

    if (!patchRes.ok) {
      // Fallback: use SDK (may still nest, but better than nothing)
      await base44.asServiceRole.entities.User.update(target_user_id, {
        data: { role: currentRole, family_id }
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}