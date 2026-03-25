import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('\n=== DEBUG CURRENT USER ===');
    console.log('Email:', currentUser.email);
    console.log('ID:', currentUser.id);
    console.log('Role:', currentUser.role);
    console.log('User data:', currentUser.data);
    console.log('User data.data:', currentUser.data?.data);

    // Try to get membership with service role
    console.log('\n=== ATTEMPTING MEMBERSHIP LOOKUP ===');
    
    const byUserId = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: currentUser.id,
      status: 'approved',
    });
    console.log('Memberships by user_id:', byUserId.length);

    const byEmail = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_email: currentUser.email,
      status: 'approved',
    });
    console.log('Memberships by user_email:', byEmail.length);

    const membership = byUserId[0] || byEmail[0];
    
    if (!membership) {
      return Response.json({
        currentUser: { email: currentUser.email, id: currentUser.id, data: currentUser.data },
        membership: null,
        error: 'No approved membership found',
      });
    }

    console.log('\n=== MEMBERSHIP FOUND ===');
    console.log('Family ID:', membership.family_id);
    console.log('Family name:', membership.user_name);

    // Now try to read Category AS THE USER (not service role)
    console.log('\n=== ATTEMPTING CATEGORY READ AS USER ===');
    try {
      const categories = await base44.entities.Category.filter({
        family_id: membership.family_id,
      });
      console.log('✓ Category read SUCCESS:', categories.length);
      return Response.json({
        success: true,
        currentUser: { email: currentUser.email, id: currentUser.id, data: currentUser.data },
        membership: { id: membership.id, family_id: membership.family_id },
        categories: categories.length,
      });
    } catch (err) {
      console.error('✗ Category read FAILED:', err.message);
      return Response.json({
        success: false,
        currentUser: { email: currentUser.email, id: currentUser.id, data: currentUser.data },
        membership: { id: membership.id, family_id: membership.family_id },
        error: 'Category read failed (RLS issue)',
        details: err.message,
      }, { status: 403 });
    }
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});