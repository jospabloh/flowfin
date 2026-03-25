import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Fetch Andy using service role
    const andyUsers = await base44.asServiceRole.entities.User.filter({
      email: 'andyramirez005@gmail.com',
    });

    if (!andyUsers.length) {
      return Response.json({ error: 'Andy not found' }, { status: 404 });
    }

    const andy = andyUsers[0];
    console.log('Andy user data:', JSON.stringify(andy.data, null, 2));

    // Get Andy's membership
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: andy.id,
      status: 'approved',
    });

    console.log('Andy memberships:', memberships.length);

    if (!memberships.length) {
      return Response.json({ 
        error: 'Andy has no approved membership',
        andy: { id: andy.id, email: andy.email, userData: andy.data }
      }, { status: 404 });
    }

    const membership = memberships[0];
    console.log('Andy membership:', JSON.stringify(membership, null, 2));

    // Get family
    const families = await base44.asServiceRole.entities.Family.filter({
      id: membership.family_id,
    });

    const family = families[0];
    console.log('Family:', family?.name);

    // Try to fetch Andy's catalogs
    const categories = await base44.asServiceRole.entities.Category.filter({
      family_id: membership.family_id,
    });

    const persons = await base44.asServiceRole.entities.Person.filter({
      family_id: membership.family_id,
    });

    const transactions = await base44.asServiceRole.entities.Transaction.filter({
      family_id: membership.family_id,
    }, '-date', 5);

    console.log('Categories:', categories.length);
    console.log('Persons:', persons.length);
    console.log('Transactions:', transactions.length);

    return Response.json({
      success: true,
      andy: {
        id: andy.id,
        email: andy.email,
        userData: andy.data,
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
      catalogs: {
        categories: categories.length,
        persons: persons.length,
        transactions: transactions.length,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});