import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const adminUser = await base44.auth.me();
    
    if (adminUser?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('\n=== SYNC JESSICA FAMILY (ADMIN) ===');

    // Get Jessica's user record using service role
    const jessicaUsers = await base44.asServiceRole.entities.User.filter({
      email: 'jess.h04058187@gmail.com',
    });

    if (!jessicaUsers.length) {
      return Response.json({ error: 'Jessica not found' }, { status: 404 });
    }

    const jessica = jessicaUsers[0];
    console.log('Jessica ID:', jessica.id);
    console.log('Jessica current family_id:', jessica.data?.family_id);

    // Get Jessica's membership
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: jessica.id,
      status: 'approved',
    });

    let membership = memberships[0];
    if (!membership) {
      const byEmail = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: jessica.email,
        status: 'approved',
      });
      membership = byEmail[0];
    }

    if (!membership) {
      return Response.json({ error: 'Jessica has no approved membership' }, { status: 404 });
    }

    console.log('Membership family_id:', membership.family_id);

    // Get family info
    const families = await base44.asServiceRole.entities.Family.filter({
      id: membership.family_id,
    });
    const family = families[0];
    console.log('Family name:', family?.name);

    // UPDATE JESSICA'S USER RECORD DIRECTLY via service role
    console.log('\nUpdating Jessica user record with family_id...');
    await base44.asServiceRole.entities.User.update(jessica.id, {
      family_id: membership.family_id,
    });
    console.log('✓ Jessica user record updated');

    // Verify the update
    const updatedJessica = await base44.asServiceRole.entities.User.filter({
      email: 'jess.h04058187@gmail.com',
    });
    const freshJessica = updatedJessica[0];
    console.log('Jessica new family_id:', freshJessica.data?.family_id);

    // Verify Jessica can read categories
    console.log('\n=== VERIFYING CATEGORY ACCESS ===');
    const categories = await base44.asServiceRole.entities.Category.filter({
      family_id: membership.family_id,
    });
    console.log('✓ Categories found:', categories.length);

    return Response.json({
      success: true,
      jessica: { id: jessica.id, email: jessica.email },
      membership: { id: membership.id, family_id: membership.family_id },
      family: { id: family.id, name: family.name },
      updated: true,
      categories: categories.length,
      message: 'Jessica family_id has been synced. She should now be able to see Jessica crew data.',
    });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});