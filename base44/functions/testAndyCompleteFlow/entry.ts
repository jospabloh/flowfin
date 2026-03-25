import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('\n=== TESTING ANDY COMPLETE FLOW ===');
    console.log('Current user:', user.email);

    // STEP 1: Sync family_id
    console.log('\n--- STEP 1: Sync family_id ---');
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });
    
    if (!memberships.length) {
      memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: user.email,
        status: 'approved',
      });
    }

    if (!memberships.length) {
      return Response.json({ error: 'No membership found' }, { status: 404 });
    }

    const membership = memberships[0];
    const currentFamilyId = user.data?.family_id;
    
    console.log('Membership family_id:', membership.family_id);
    console.log('Current user data.family_id:', currentFamilyId);

    if (currentFamilyId !== membership.family_id) {
      console.log('Attempting updateMe...');
      try {
        await base44.auth.updateMe({ family_id: membership.family_id });
        console.log('updateMe succeeded');
      } catch (err) {
        console.error('updateMe failed:', err.message);
        return Response.json({ 
          error: 'updateMe failed',
          details: err.message,
          user: { email: user.email, id: user.id }
        }, { status: 500 });
      }
    } else {
      console.log('family_id already correct');
    }

    // STEP 2: Get family and config
    console.log('\n--- STEP 2: Get family info ---');
    const families = await base44.asServiceRole.entities.Family.filter({
      id: membership.family_id,
    });

    const family = families[0];
    console.log('Family:', family?.name);

    const configs = await base44.asServiceRole.entities.FamilyConfig.filter({
      family_id: membership.family_id,
    });

    const familyConfig = configs[0];
    console.log('FamilyConfig exists:', !!familyConfig);

    // STEP 3: Fetch catalogs AS THE USER (not service role)
    console.log('\n--- STEP 3: Fetch catalogs as user ---');
    try {
      const categories = await base44.entities.Category.filter({
        family_id: membership.family_id,
      });
      console.log('Categories (user RLS):', categories.length);

      const subcategories = await base44.entities.Subcategory.filter({
        family_id: membership.family_id,
      });
      console.log('Subcategories (user RLS):', subcategories.length);

      const persons = await base44.entities.Person.filter({
        family_id: membership.family_id,
      });
      console.log('Persons (user RLS):', persons.length);

      const paymentMethods = await base44.entities.PaymentMethod.filter({
        family_id: membership.family_id,
      });
      console.log('PaymentMethods (user RLS):', paymentMethods.length);

      const transactions = await base44.entities.Transaction.filter({
        family_id: membership.family_id,
      }, '-date', 5);
      console.log('Transactions (user RLS):', transactions.length);

      return Response.json({
        success: true,
        user: { id: user.id, email: user.email },
        membership: { id: membership.id, family_id: membership.family_id, role: membership.role },
        family: { id: family.id, name: family.name },
        familyConfig: { id: familyConfig?.id, locale: familyConfig?.locale },
        catalogs: {
          categories: categories.length,
          subcategories: subcategories.length,
          persons: persons.length,
          paymentMethods: paymentMethods.length,
          transactions: transactions.length,
        },
      });
    } catch (err) {
      console.error('Catalog fetch failed:', err.message);
      return Response.json({
        error: 'Catalog fetch failed',
        details: err.message,
        user: { email: user.email },
        membership: { family_id: membership.family_id },
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});