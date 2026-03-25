import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('\n=== SYNC USER FAMILY FORCE ===');
    console.log('User:', user.email);
    console.log('Current family_id:', user.data?.family_id);

    // Get membership with service role (bypass any RLS)
    const byUserId = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });

    let membership = byUserId[0];
    
    if (!membership) {
      const byEmail = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: user.email,
        status: 'approved',
      });
      membership = byEmail[0];
    }

    if (!membership) {
      console.log('ERROR: No approved membership found for user');
      return Response.json({ 
        error: 'No approved membership found',
        user: { id: user.id, email: user.email }
      }, { status: 404 });
    }

    console.log('Found membership:', membership.id);
    console.log('Membership family_id:', membership.family_id);

    // Check current state
    const currentFamilyId = user.data?.family_id;
    console.log('Current user.data.family_id:', currentFamilyId);

    // Always update to ensure it's correct
    console.log('Calling updateMe with family_id:', membership.family_id);
    await base44.auth.updateMe({ family_id: membership.family_id });
    console.log('✓ updateMe succeeded');

    // Fetch fresh user to confirm
    const freshUser = await base44.auth.me();
    console.log('Fresh user data.family_id:', freshUser.data?.family_id);

    // Try to read Category as user
    console.log('\n=== TESTING CATEGORY READ ===');
    try {
      const cats = await base44.entities.Category.filter({
        family_id: membership.family_id,
      });
      console.log('✓ Category read SUCCESS:', cats.length);
      return Response.json({
        success: true,
        user: { id: user.id, email: user.email },
        membership: { id: membership.id, family_id: membership.family_id },
        synced: true,
        categories: cats.length,
      });
    } catch (catErr) {
      console.error('✗ Category read FAILED:', catErr.message);
      return Response.json({
        success: false,
        user: { id: user.id, email: user.email },
        membership: { id: membership.id, family_id: membership.family_id },
        synced: true,
        error: 'Category read failed even after sync',
        details: catErr.message,
      }, { status: 403 });
    }
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});