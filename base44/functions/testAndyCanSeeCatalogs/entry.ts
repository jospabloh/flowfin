import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get Andy's user record
    const andyUsers = await base44.asServiceRole.entities.User.filter({
      email: 'andyramirez005@gmail.com',
    });

    if (!andyUsers.length) {
      return Response.json({ error: 'Andy not found' }, { status: 404 });
    }

    const andy = andyUsers[0];
    const andyFamilyId = andy.data?.family_id || andy.data?.data?.family_id;

    console.log('Andy data structure:', JSON.stringify(andy.data, null, 2));
    console.log('Andy family_id found:', andyFamilyId);

    if (!andyFamilyId) {
      return Response.json({ error: 'Andy has no family_id' }, { status: 400 });
    }

    // Try to fetch as service role (simulating what RLS would match)
    const categories = await base44.asServiceRole.entities.Category.filter({
      family_id: andyFamilyId,
    });

    const subcategories = await base44.asServiceRole.entities.Subcategory.filter({
      family_id: andyFamilyId,
    });

    const persons = await base44.asServiceRole.entities.Person.filter({
      family_id: andyFamilyId,
    });

    const paymentMethods = await base44.asServiceRole.entities.PaymentMethod.filter({
      family_id: andyFamilyId,
    });

    return Response.json({
      success: true,
      andyId: andy.id,
      andyDataStructure: andy.data,
      familyIdFound: andyFamilyId,
      categoriesCount: categories.length,
      subcategoriesCount: subcategories.length,
      personsCount: persons.length,
      paymentMethodsCount: paymentMethods.length,
      canSeeCatalogs: categories.length > 0 && paymentMethods.length > 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});