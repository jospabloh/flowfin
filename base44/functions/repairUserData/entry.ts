import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Repairs user data by calling auth.updateMe AS the user (user-scoped token)
// This is the only reliable way to write family_id at the correct level
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Find user's approved membership
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });

    if (!memberships.length) {
      return Response.json({ repaired: false, reason: 'no membership' });
    }

    const family_id = memberships[0].family_id;

    // Check if already correct
    if (user.data?.family_id === family_id) {
      return Response.json({ repaired: false, reason: 'already correct', family_id });
    }

    // Use auth.updateMe with user token — writes at the correct level
    await base44.auth.updateMe({ data: { family_id } });

    return Response.json({ repaired: true, family_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});