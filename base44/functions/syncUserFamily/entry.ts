import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    console.log('syncUserFamily: user =', user?.email);
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get approved membership by user_id
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });
    
    console.log('syncUserFamily: memberships by user_id =', memberships.length);
    
    // Fallback to user_email
    if (!memberships.length) {
      memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: user.email,
        status: 'approved',
      });
      console.log('syncUserFamily: memberships by user_email =', memberships.length);
    }

    if (!memberships.length) {
      console.log('syncUserFamily: no memberships found');
      return Response.json({ error: 'No approved membership found' }, { status: 404 });
    }

    const membership = memberships[0];
    const currentFamilyId = user.data?.family_id;
    
    console.log('syncUserFamily: currentFamilyId =', currentFamilyId, ', membership.family_id =', membership.family_id);

    // Only update if different
    if (currentFamilyId !== membership.family_id) {
      console.log('syncUserFamily: updating family_id...');
      try {
        await base44.auth.updateMe({ family_id: membership.family_id });
        console.log('syncUserFamily: updateMe succeeded');
      } catch (err) {
        // If updateMe fails, log but continue
        console.error('syncUserFamily: Failed to update family_id:', err.message);
      }
    } else {
      console.log('syncUserFamily: family_id already correct, no update needed');
    }

    console.log('syncUserFamily: returning success');
    return Response.json({ success: true, family_id: membership.family_id });
  } catch (error) {
    console.error('syncUserFamily: error =', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});