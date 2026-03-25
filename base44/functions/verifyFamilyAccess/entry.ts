import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('\n=== VERIFY FAMILY ACCESS ===');
    console.log('User:', user.email);

    // Step 1: Get membership
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
      return Response.json({
        user: user.email,
        hasFamily: false,
        error: 'No approved membership',
      });
    }

    console.log('Family ID:', membership.family_id);

    // Step 2: Get family
    const families = await base44.asServiceRole.entities.Family.filter({
      id: membership.family_id,
    });
    const family = families[0];

    // Step 3: TRY TO READ AS USER (not service role)
    console.log('\n=== TESTING USER-LEVEL READS ===');

    const results = {};

    // Category
    try {
      const cats = await base44.entities.Category.filter({
        family_id: membership.family_id,
      });
      results.categories = { success: true, count: cats.length };
      console.log('✓ Categories:', cats.length);
    } catch (err) {
      results.categories = { success: false, error: err.message };
      console.error('✗ Categories:', err.message);
    }

    // Subcategory
    try {
      const subs = await base44.entities.Subcategory.filter({
        family_id: membership.family_id,
      });
      results.subcategories = { success: true, count: subs.length };
      console.log('✓ Subcategories:', subs.length);
    } catch (err) {
      results.subcategories = { success: false, error: err.message };
      console.error('✗ Subcategories:', err.message);
    }

    // Person
    try {
      const persons = await base44.entities.Person.filter({
        family_id: membership.family_id,
      });
      results.persons = { success: true, count: persons.length };
      console.log('✓ Persons:', persons.length);
    } catch (err) {
      results.persons = { success: false, error: err.message };
      console.error('✗ Persons:', err.message);
    }

    // PaymentMethod
    try {
      const methods = await base44.entities.PaymentMethod.filter({
        family_id: membership.family_id,
      });
      results.paymentMethods = { success: true, count: methods.length };
      console.log('✓ PaymentMethods:', methods.length);
    } catch (err) {
      results.paymentMethods = { success: false, error: err.message };
      console.error('✗ PaymentMethods:', err.message);
    }

    // Transaction
    try {
      const txns = await base44.entities.Transaction.filter({
        family_id: membership.family_id,
      }, '-date', 5);
      results.transactions = { success: true, count: txns.length };
      console.log('✓ Transactions:', txns.length);
    } catch (err) {
      results.transactions = { success: false, error: err.message };
      console.error('✗ Transactions:', err.message);
    }

    const allSuccess = Object.values(results).every(r => r.success);

    return Response.json({
      user: user.email,
      family: family?.name,
      membership: { id: membership.id, role: membership.role },
      allAccessible: allSuccess,
      results,
    });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});