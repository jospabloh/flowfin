import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get Andy using service role for verification
    const andyUsers = await base44.asServiceRole.entities.User.filter({
      email: 'andyramirez005@gmail.com',
    });

    if (!andyUsers.length) {
      return Response.json({ error: 'Andy not found' }, { status: 404 });
    }

    const andy = andyUsers[0];

    // Verify Andy's membership
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: andy.id,
      status: 'approved',
    });

    if (!memberships.length) {
      return Response.json({ error: 'Andy has no approved membership' }, { status: 404 });
    }

    const membership = memberships[0];

    // Get family
    const families = await base44.asServiceRole.entities.Family.filter({
      id: membership.family_id,
    });
    const family = families[0];

    // Get config
    const configs = await base44.asServiceRole.entities.FamilyConfig.filter({
      family_id: membership.family_id,
    });
    const familyConfig = configs[0];

    // Verify Andy can read catalogs
    const categories = await base44.asServiceRole.entities.Category.filter({
      family_id: membership.family_id,
    });

    const subcategories = await base44.asServiceRole.entities.Subcategory.filter({
      family_id: membership.family_id,
    });

    const persons = await base44.asServiceRole.entities.Person.filter({
      family_id: membership.family_id,
    });

    const paymentMethods = await base44.asServiceRole.entities.PaymentMethod.filter({
      family_id: membership.family_id,
    });

    const transactions = await base44.asServiceRole.entities.Transaction.filter({
      family_id: membership.family_id,
    }, '-date', 10);

    return Response.json({
      success: true,
      validations: {
        andyExists: !!andy.id,
        hasApprovedMembership: !!membership.id,
        hasFamilyName: family.name === 'Jessica crew',
        hasFamilyConfig: !!familyConfig?.id,
        canSeeCategoriesCount: categories.length === 12,
        canSeeSubcategoriesCount: subcategories.length === 24,
        canSeePersonsCount: persons.length === 2,
        canSeePaymentMethodsCount: paymentMethods.length === 2,
        canSeeTransactions: transactions.length > 0,
      },
      allCorrect: 
        !!andy.id && 
        !!membership.id && 
        family.name === 'Jessica crew' && 
        !!familyConfig?.id &&
        categories.length === 12 &&
        subcategories.length === 24 &&
        persons.length === 2 &&
        paymentMethods.length === 2 &&
        transactions.length > 0,
      details: {
        andy: { id: andy.id, email: andy.email, userData: andy.data },
        membership: { id: membership.id, family_id: membership.family_id, role: membership.role },
        family: { id: family.id, name: family.name },
        counts: {
          categories: categories.length,
          subcategories: subcategories.length,
          persons: persons.length,
          paymentMethods: paymentMethods.length,
          transactions: transactions.length,
        },
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});