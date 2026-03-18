import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { join_code, user_email, user_name } = await req.json();

    if (!join_code || !user_email) {
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Search family by code using service role (user may not be registered yet)
    const families = await base44.asServiceRole.entities.Family.filter({ join_code: join_code.trim().toUpperCase() });
    if (!families.length) {
      return Response.json({ found: false, error: 'Código no encontrado' });
    }
    const family = families[0];

    // Invite the user to the app so they can access it
    await base44.asServiceRole.users.inviteUser(user_email, 'user');

    // Find the new user record
    const users = await base44.asServiceRole.entities.User.filter({ email: user_email });
    const targetUser = users[0];
    if (!targetUser) {
      return Response.json({ error: 'Usuario no encontrado tras invitar' }, { status: 500 });
    }

    // Clean up any old memberships with same email
    const existingByEmail = await base44.asServiceRole.entities.FamilyMembership.filter({ 
      family_id: family.id, 
      user_email: user_email 
    });
    // Check if already approved
    const alreadyApproved = existingByEmail.find(m => m.status === 'approved' && m.user_id === targetUser.id);
    if (alreadyApproved) {
      // Set family_id on user and return success
      await base44.asServiceRole.entities.User.update(targetUser.id, { family_id: family.id });
      return Response.json({ success: true, already_member: true });
    }

    // Delete old memberships for different user_ids
    for (const m of existingByEmail) {
      if (m.user_id !== targetUser.id) {
        await base44.asServiceRole.entities.FamilyMembership.delete(m.id);
      }
    }

    // Create approved membership directly (family admin approves on join)
    await base44.asServiceRole.entities.FamilyMembership.create({
      family_id: family.id,
      user_id: targetUser.id,
      user_email: user_email,
      user_name: user_name || user_email,
      role: 'member',
      status: 'approved',
    });

    // Set family_id on user record
    await base44.asServiceRole.entities.User.update(targetUser.id, { family_id: family.id });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});