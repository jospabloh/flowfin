import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('User:', user.email);
    console.log('User data:', JSON.stringify(user.data, null, 2));

    // Step 1: Sync
    console.log('\n=== STEP 1: syncUserFamily ===');
    let syncResult = null;
    try {
      const syncRes = await base44.functions.invoke('syncUserFamily', {});
      syncResult = syncRes.data;
      console.log('Sync result:', JSON.stringify(syncResult, null, 2));
    } catch (err) {
      console.error('Sync error:', err.message);
      return Response.json({ error: 'Sync failed', details: err.message }, { status: 500 });
    }

    // Step 2: Get membership
    console.log('\n=== STEP 2: getMyMembership ===');
    let membershipResult = null;
    try {
      const memRes = await base44.functions.invoke('getMyMembership', {});
      membershipResult = memRes.data;
      console.log('Membership result:', JSON.stringify(membershipResult, null, 2));
    } catch (err) {
      console.error('Membership error:', err.message);
      return Response.json({ error: 'getMyMembership failed', details: err.message }, { status: 500 });
    }

    // Step 3: Try to fetch catalogs directly
    console.log('\n=== STEP 3: Fetch catalogs as user ===');
    try {
      const familyId = membershipResult?.family?.id;
      console.log('Family ID:', familyId);

      // Try as user (should fail if RLS is wrong)
      const categories = await base44.entities.Category.filter({ family_id: familyId });
      console.log('Categories (user):', categories.length);

      const persons = await base44.entities.Person.filter({ family_id: familyId });
      console.log('Persons (user):', persons.length);
    } catch (err) {
      console.error('Catalog error:', err.message);
      return Response.json({ 
        error: 'Cannot fetch catalogs as user',
        details: err.message,
        membership: membershipResult,
        sync: syncResult
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      user: { id: user.id, email: user.email, fullName: user.full_name },
      userData: user.data,
      sync: syncResult,
      membership: membershipResult,
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});