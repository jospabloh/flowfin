import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    // This function will be tested as the admin, but we'll use the service role
    // to simulate what Andy should see
    const base44 = createClientFromRequest(req);
    
    // For this test, manually set Andy's family_id
    const andyFamilyId = '69c40e9a8ea547f19057c84c';
    
    // Fetch categories as if Andy has this family_id
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
      categoriesCount: categories.length,
      subcategoriesCount: subcategories.length,
      personsCount: persons.length,
      paymentMethodsCount: paymentMethods.length,
      categories: categories.map(c => ({ id: c.id, name: c.name, icon: c.icon })),
      persons: persons.map(p => ({ id: p.id, name: p.name })),
      paymentMethods: paymentMethods.map(pm => ({ id: pm.id, name: pm.name })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});