import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

export async function handle(req: Request, body: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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
