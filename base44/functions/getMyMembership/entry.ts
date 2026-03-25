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

    // Fallback: search by email in case user_id wasn't stored
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

    // Auto-fix: if user.data.family_id is missing or nested incorrectly, self-heal using updateMe
    // auth.me() returns user.data at the true flat level — if family_id is wrong, fix it
    if (user.data?.family_id !== membership.family_id) {
      await base44.auth.updateMe({ data: { family_id: membership.family_id } });
    }

    return Response.json({ membership, family });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});