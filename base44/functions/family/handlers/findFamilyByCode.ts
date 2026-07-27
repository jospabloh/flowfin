import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { join_code } = await req.json();

    // Search family by code using service role (bypasses RLS)
    const families = await base44.asServiceRole.entities.Family.filter({ join_code: join_code.trim().toUpperCase() });
    if (!families.length) {
      return Response.json({ found: false });
    }

    const family = families[0];

    // Check existing membership for the authenticated caller (never trust a client-supplied user_id)
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      family_id: family.id,
      user_id: user.id
    });

    return Response.json({ 
      found: true, 
      family_id: family.id,
      existing_membership: memberships[0] || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}