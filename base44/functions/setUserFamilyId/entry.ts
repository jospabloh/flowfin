import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Strict admin-only check at top-level before any other logic
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    const ownerEmail = Deno.env.get('APP_OWNER_EMAIL');
    if (!ownerEmail || user.email !== ownerEmail) return Response.json({ error: 'Forbidden: requiere ser administrador de plataforma' }, { status: 403 });

    const { target_user_id, family_id } = await req.json();

    if (!target_user_id || !family_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Server-side tenant guard: reject unless the target user has an approved
    // FamilyMembership in the target family. This is the multi-tenant
    // isolation the field-level rls.write lock used to enforce before it was
    // removed (2026-08-25) for stripping family_id from non-admin reads.
    // asServiceRole bypasses RLS, so this check is the gate that keeps a
    // user from being dropped into a family they don't belong to.
    const targetUsers = await base44.asServiceRole.entities.User.filter({ id: target_user_id });
    const targetUser = targetUsers?.[0];
    if (!targetUser) return Response.json({ error: 'Target user not found' }, { status: 404 });

    const familyMembers = await base44.asServiceRole.entities.FamilyMembership.filter({
      family_id,
      status: 'approved',
    });
    const belongs = (familyMembers || []).some(
      (m) => m.user_id === target_user_id ||
        (targetUser.email && m.user_email === targetUser.email)
    );
    if (!belongs) {
      return Response.json(
        { error: 'Target user has no approved membership in this family' },
        { status: 403 }
      );
    }

    // Update family_id, preserving the rest of the user's data (role,
    // preferences). delete userData.data avoids the SDK deep-merge nesting
    // bug (see approveMember/createFamily for the same pattern).
    const userData = { ...(targetUser.data || {}), family_id };
    delete userData.data;
    await base44.asServiceRole.entities.User.update(target_user_id, { data: userData });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});