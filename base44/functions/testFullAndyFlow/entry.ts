import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (user.email !== 'andyramirez005@gmail.com') {
      return Response.json({ 
        error: 'This test must be run as Andy',
        currentUser: user.email 
      }, { status: 403 });
    }

    console.log('\n=== FULL ANDY FLOW TEST ===');
    console.log('User:', user.email);
    console.log('User ID:', user.id);
    console.log('User family_id:', user.data?.family_id);

    // Step 1: Get membership
    console.log('\n--- Step 1: Getting membership ---');
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });

    let membership = memberships[0];
    if (!membership) {
      const byEmail = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: user.email,
        status: 'approved',
      });
      membership = byEmail[0];
    }

    if (!membership) {
      return Response.json({ error: 'No approved membership' }, { status: 404 });
    }

    console.log('Membership found:', membership.id);
    console.log('Family ID:', membership.family_id);

    // Step 2: Get family
    console.log('\n--- Step 2: Getting family ---');
    const families = await base44.asServiceRole.entities.Family.filter({
      id: membership.family_id,
    });
    const family = families[0];
    console.log('Family:', family?.name);

    // Step 3: Get config
    console.log('\n--- Step 3: Getting family config ---');
    const configs = await base44.asServiceRole.entities.FamilyConfig.filter({
      family_id: membership.family_id,
    });
    const config = configs[0];
    console.log('Config:', !!config);

    // Step 4: Read catalogs AS ANDY (user-level RLS)
    console.log('\n--- Step 4: Reading catalogs AS ANDY ---');

    const categories = await base44.entities.Category.filter({
      family_id: membership.family_id,
    });
    console.log('✓ Categories:', categories.length);

    const subcategories = await base44.entities.Subcategory.filter({
      family_id: membership.family_id,
    });
    console.log('✓ Subcategories:', subcategories.length);

    const persons = await base44.entities.Person.filter({
      family_id: membership.family_id,
    });
    console.log('✓ Persons:', persons.length);

    const paymentMethods = await base44.entities.PaymentMethod.filter({
      family_id: membership.family_id,
    });
    console.log('✓ PaymentMethods:', paymentMethods.length);

    const transactions = await base44.entities.Transaction.filter({
      family_id: membership.family_id,
    }, '-date', 10);
    console.log('✓ Transactions:', transactions.length);

    // Step 5: Success!
    console.log('\n=== SUCCESS! ANDY CAN ACCESS EVERYTHING ===');
    return Response.json({
      success: true,
      user: { email: user.email, id: user.id },
      family: { id: family.id, name: family.name },
      catalogs: {
        categories: categories.length,
        subcategories: subcategories.length,
        persons: persons.length,
        paymentMethods: paymentMethods.length,
        transactions: transactions.length,
      },
    });
  } catch (error) {
    console.error('ERROR:', error.message);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});