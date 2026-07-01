import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Lightweight version - just returns membership + family + config in one call
// Frontend now queries directly via entity SDK; this function is kept for compatibility only
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Single filter by user_id
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
    if (!membership) {
      return Response.json({ membership: null, family: null, familyConfig: null });
    }

    const [families, configs] = await Promise.all([
      base44.asServiceRole.entities.Family.filter({ id: membership.family_id }),
      base44.asServiceRole.entities.FamilyConfig.filter({ family_id: membership.family_id }),
    ]);

    return Response.json({
      membership,
      family: families[0] || null,
      familyConfig: configs[0] || null,
    });
  } catch (error) {
    console.error('getMyMembership error:', error);
    const status = error?.status === 429 ? 503 : 500;
    return Response.json({ error: error.message }, { status });
  }
}