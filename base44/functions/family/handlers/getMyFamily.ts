import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

export async function handle(req: Request, body: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { family_id } = body;
    if (!family_id) return Response.json({ family: null });

    // Authorization: a caller may only read a family they belong to. Without
    // this check, any authenticated user could pass an arbitrary family_id and
    // read another family's record through the service-role client below.
    const isAdmin = user.role === 'admin';
    const ownFamilyId = user?.data?.family_id || user?.data?.data?.family_id;

    let authorized = isAdmin || family_id === ownFamilyId;
    if (!authorized) {
      // Memberships may be keyed by user_id or, for some accounts, only by
      // user_email — mirror the user_id -> user_email fallback used elsewhere
      // (e.g. getMyMembership) so email-based members aren't wrongly denied.
      let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_id: user.id,
        family_id,
        status: 'approved',
      });
      if (!memberships.length) {
        memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
          user_email: user.email,
          family_id,
          status: 'approved',
        });
      }
      authorized = memberships.length > 0;
    }

    if (!authorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const families = await base44.asServiceRole.entities.Family.filter({ id: family_id });
    return Response.json({ family: families[0] || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
