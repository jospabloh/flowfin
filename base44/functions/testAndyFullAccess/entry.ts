import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get Andy (simulate as Andy)
    const andyUsers = await base44.asServiceRole.entities.User.filter({
      email: 'andyramirez005@gmail.com',
    });

    if (!andyUsers.length) {
      return Response.json({ error: 'Andy not found' }, { status: 404 });
    }

    const andy = andyUsers[0];
    console.log('Andy user:', JSON.stringify(andy, null, 2));

    // Test 1: Get Andy's membership
    console.log('\n=== TEST 1: Get membership ===');
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: andy.id,
      status: 'approved',
    });

    if (!memberships.length) {
      return Response.json({ error: 'No memberships found for Andy' }, { status: 404 });
    }

    const membership = memberships[0];
    console.log('Membership:', JSON.stringify(membership, null, 2));

    // Test 2: Get family info
    console.log('\n=== TEST 2: Get family ===');
    const families = await base44.asServiceRole.entities.Family.filter({
      id: membership.family_id,
    });

    if (!families.length) {
      return Response.json({ error: 'Family not found' }, { status: 404 });
    }

    const family = families[0];
    console.log('Family:', JSON.stringify(family, null, 2));

    // Test 3: Get family config
    console.log('\n=== TEST 3: Get family config ===');
    const configs = await base44.asServiceRole.entities.FamilyConfig.filter({
      family_id: membership.family_id,
    });
    const familyConfig = configs.length > 0 ? configs[0] : null;
    console.log('Config exists:', !!familyConfig);

    // Test 4: Get catalogs (should work with RLS)
    console.log('\n=== TEST 4: Get catalogs ===');
    const categories = await base44.asServiceRole.entities.Category.filter({
      family_id: membership.family_id,
    });
    console.log('Categories count:', categories.length);

    const subcategories = await base44.asServiceRole.entities.Subcategory.filter({
      family_id: membership.family_id,
    });
    console.log('Subcategories count:', subcategories.length);

    const persons = await base44.asServiceRole.entities.Person.filter({
      family_id: membership.family_id,
    });
    console.log('Persons count:', persons.length);

    const paymentMethods = await base44.asServiceRole.entities.PaymentMethod.filter({
      family_id: membership.family_id,
    });
    console.log('Payment methods count:', paymentMethods.length);

    // Test 5: Get transactions
    console.log('\n=== TEST 5: Get transactions ===');
    const transactions = await base44.asServiceRole.entities.Transaction.filter({
      family_id: membership.family_id,
    }, '-date', 10);
    console.log('Transactions count:', transactions.length);

    // Test 6: Verify syncUserFamily would work
    console.log('\n=== TEST 6: Check user data structure ===');
    const currentFamilyId = andy.data?.family_id;
    console.log('Current user.data.family_id:', currentFamilyId);
    console.log('Expected family_id:', membership.family_id);
    console.log('Match:', currentFamilyId === membership.family_id);

    return Response.json({
      success: true,
      andy: {
        id: andy.id,
        email: andy.email,
        full_name: andy.full_name,
      },
      membership: {
        id: membership.id,
        family_id: membership.family_id,
        role: membership.role,
        status: membership.status,
      },
      family: {
        id: family.id,
        name: family.name,
      },
      catalogs: {
        categories: categories.length,
        subcategories: subcategories.length,
        persons: persons.length,
        paymentMethods: paymentMethods.length,
      },
      transactions: transactions.length,
      userDataMatch: currentFamilyId === membership.family_id,
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});