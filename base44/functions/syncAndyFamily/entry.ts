import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const adminUser = await base44.auth.me();
    
    if (adminUser?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('\n=== SYNC ANDY FAMILY (ADMIN) ===');

    // Get Andy's user record using service role
    const andyUsers = await base44.asServiceRole.entities.User.filter({
      email: 'andyramirez005@gmail.com',
    });

    if (!andyUsers.length) {
      return Response.json({ error: 'Andy not found' }, { status: 404 });
    }

    const andy = andyUsers[0];
    console.log('Andy ID:', andy.id);
    console.log('Andy current family_id:', andy.data?.family_id);

    // Get Andy's membership
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: andy.id,
      status: 'approved',
    });

    if (!memberships.length) {
      const byEmail = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: andy.email,
        status: 'approved',
      });
      if (!byEmail.length) {
        return Response.json({ error: 'Andy has no approved membership' }, { status: 404 });
      }
    }

    const membership = memberships[0] || byEmail[0];
    console.log('Membership family_id:', membership.family_id);

    // Get family info
    const families = await base44.asServiceRole.entities.Family.filter({
      id: membership.family_id,
    });
    const family = families[0];
    console.log('Family name:', family?.name);

    // UPDATE ANDY'S USER RECORD DIRECTLY via service role
    console.log('\nUpdating Andy user record with family_id...');
    await base44.asServiceRole.entities.User.update(andy.id, {
      family_id: membership.family_id,
    });
    console.log('✓ Andy user record updated');

    // Verify the update
    const updatedAndy = await base44.asServiceRole.entities.User.filter({
      email: 'andyramirez005@gmail.com',
    });
    const freshAndy = updatedAndy[0];
    console.log('Andy new family_id:', freshAndy.data?.family_id);

    // Verify Andy can read categories using service role simulation
    console.log('\n=== VERIFYING CATEGORY ACCESS ===');
    const categories = await base44.asServiceRole.entities.Category.filter({
      family_id: membership.family_id,
    });
    console.log('✓ Categories found:', categories.length);

    return Response.json({
      success: true,
      andy: { id: andy.id, email: andy.email },
      membership: { id: membership.id, family_id: membership.family_id },
      family: { id: family.id, name: family.name },
      updated: true,
      categories: categories.length,
      message: 'Andy family_id has been synced. He should now be able to see Jessica crew data.',
    });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});