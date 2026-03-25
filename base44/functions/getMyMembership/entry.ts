import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    console.log('getMyMembership: user =', user.email);

    // Try by user_id first, fallback to user_email
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });

    console.log('getMyMembership: memberships by user_id =', memberships.length);

    if (!memberships.length) {
      memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: user.email,
        status: 'approved',
      });
      console.log('getMyMembership: memberships by user_email =', memberships.length);
    }

    const membership = memberships[0] || null;
    if (!membership) {
      console.log('getMyMembership: no membership found, returning null');
      return Response.json({ membership: null, family: null });
    }

    console.log('getMyMembership: membership found =', membership.id);

    const families = await base44.asServiceRole.entities.Family.filter({ id: membership.family_id });
    const family = families[0] || null;

    console.log('getMyMembership: family =', family?.name);

    // Auto-sync: ensure user.data.family_id is set correctly
    const currentFamilyId = user.data?.family_id || user.data?.data?.family_id;
    console.log('getMyMembership: currentFamilyId =', currentFamilyId, ', expected =', membership.family_id);
    
    if (currentFamilyId !== membership.family_id) {
      try {
        console.log('getMyMembership: AUTO-SYNCING family_id...');
        await base44.auth.updateMe({ family_id: membership.family_id });
        console.log('getMyMembership: AUTO-SYNC successful');
      } catch (err) {
        console.error('getMyMembership: AUTO-SYNC failed:', err.message);
        // Don't return error - continue anyway, user might still be able to access catalogs
      }
    } else {
      console.log('getMyMembership: family_id already correct');
    }

    // Fetch FamilyConfig via service role so ALL members get it regardless of RLS
    const configs = await base44.asServiceRole.entities.FamilyConfig.filter({ family_id: membership.family_id });
    const familyConfig = configs[0] || null;

    console.log('getMyMembership: returning data successfully');
    return Response.json({ membership, family, familyConfig });
  } catch (error) {
    console.error('getMyMembership error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});