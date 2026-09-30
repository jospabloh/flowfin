import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Last-admin guard (same rule as family/removeMember): if this user is the
    // only approved admin of a family that still has other approved members,
    // leaving would strand them with no admin. Inlined: Deno cannot import
    // across function directories. A family of one may be left.
    const sr = base44.asServiceRole;
    const mine = await sr.entities.FamilyMembership.filter({ user_id: user.id, status: 'approved', role: 'admin' });
    for (const m of mine) {
      const rows = await sr.entities.FamilyMembership.filter({ family_id: m.family_id, status: 'approved' });
      const others = rows.filter((r: { id: string }) => r.id !== m.id);
      const otherAdmin = others.some((r: { role?: string }) => r.role === 'admin');
      if (others.length && !otherAdmin) {
        return Response.json({
          error: 'Eres el único administrador de tu familia. Nombra a otro administrador antes de eliminar tu cuenta.',
          code: 'last_admin',
        }, { status: 409 });
      }
    }

    // Remove all family memberships created by this user
    const memberships = await base44.entities.FamilyMembership.filter({ user_id: user.id });
    for (const m of memberships) {
      await base44.entities.FamilyMembership.delete(m.id);
    }

    // Clear family association from user profile
    await base44.auth.updateMe({ family_id: null, admin_family_ids: null });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}