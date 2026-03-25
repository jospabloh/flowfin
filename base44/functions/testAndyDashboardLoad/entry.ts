import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Simulate what happens in FamilyProvider when user opens the app
    console.log('=== SIMULATING ANDY DASHBOARD LOAD ===\n');

    // Step 1: Get current user (like base44.auth.me())
    const user = await base44.auth.me();
    console.log('Step 1 - Get current user:');
    console.log('  User:', user?.email);
    console.log('  User data.family_id:', user?.data?.family_id);
    
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Step 2: Call syncUserFamily
    console.log('\nStep 2 - Sync user family...');
    try {
      const syncRes = await base44.functions.invoke('syncUserFamily', {});
      console.log('  Sync result:', syncRes.data?.success);
    } catch (err) {
      console.log('  Sync error:', err.message);
    }

    // Step 3: Call getMyMembership
    console.log('\nStep 3 - Get my membership...');
    try {
      const memberRes = await base44.functions.invoke('getMyMembership', {});
      console.log('  Response received');
      
      const { membership, family, familyConfig } = memberRes.data;
      
      if (!membership) {
        console.log('  ERROR: No membership returned!');
        return Response.json({
          error: 'getMyMembership returned no data',
          memberRes: memberRes.data,
        }, { status: 500 });
      }
      
      console.log('  Membership ID:', membership?.id);
      console.log('  Family name:', family?.name);
      console.log('  Family ID:', family?.id);
      console.log('  Config exists:', !!familyConfig);

      // Step 4: Verify user can see catalog
      console.log('\nStep 4 - Verify catalog access...');
      const categories = await base44.entities.Category.filter(
        { family_id: family.id },
        '-date',
        10
      );
      console.log('  Categories visible:', categories.length);

      // Return success with all data
      return Response.json({
        success: true,
        user: {
          email: user.email,
          id: user.id,
        },
        membership: {
          id: membership.id,
          family_id: membership.family_id,
          role: membership.role,
        },
        family: {
          id: family.id,
          name: family.name,
        },
        familyConfig: {
          exists: !!familyConfig,
          currency: familyConfig?.currency,
        },
        catalogs: {
          categories: categories.length,
        },
        readyForUI: !!(membership && family && familyConfig),
      });
    } catch (err) {
      console.log('  ERROR:', err.message);
      return Response.json({
        error: 'getMyMembership failed',
        details: err.message,
      }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});