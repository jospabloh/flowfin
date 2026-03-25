import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    // This simulates what getMyMembership would do as Andy
    const base44 = createClientFromRequest(req);
    
    // Get all Andy records
    const users = await base44.asServiceRole.entities.User.filter({
      email: 'andyramirez005@gmail.com',
    });

    if (!users.length) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];
    console.log('=== User Data ===');
    console.log(JSON.stringify(user, null, 2));

    // Get approved membership by user_id first
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });
    
    console.log('\n=== Membership lookup by user_id ===');
    console.log('Found:', memberships.length > 0 ? 'Yes' : 'No');

    // Fallback to user_email
    if (!memberships.length) {
      console.log('Fallback to email...');
      memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: user.email,
        status: 'approved',
      });
      console.log('Found by email:', memberships.length > 0 ? 'Yes' : 'No');
    }

    if (!memberships.length) {
      return Response.json({ error: 'No approved membership found' }, { status: 404 });
    }

    const membership = memberships[0];

    // Get family
    const families = await base44.asServiceRole.entities.Family.filter({
      id: membership.family_id,
    });

    if (!families.length) {
      return Response.json({ error: 'Family not found' }, { status: 404 });
    }

    const family = families[0];

    // Get family config
    const configs = await base44.asServiceRole.entities.FamilyConfig.filter({
      family_id: membership.family_id,
    });

    const familyConfig = configs.length > 0 ? configs[0] : null;

    // Return what the actual getMyMembership would return
    return Response.json({
      success: true,
      membership,
      family,
      familyConfig,
      result: {
        membership,
        family,
        familyConfig,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});