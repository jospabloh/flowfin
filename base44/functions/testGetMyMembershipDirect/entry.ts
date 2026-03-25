import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    console.log('Current user:', user?.email);
    console.log('User ID:', user?.id);
    console.log('User data:', JSON.stringify(user?.data));

    // Check if this is Andy
    if (user?.email !== 'andyramirez005@gmail.com') {
      return Response.json({
        error: 'This test is for Andy only',
        currentUser: user?.email,
      }, { status: 400 });
    }

    // Try getMyMembership directly
    try {
      const res = await base44.functions.invoke('getMyMembership', {});
      console.log('getMyMembership response:', res.status);
      console.log('Response data:', JSON.stringify(res.data, null, 2));
      
      if (res.status === 200) {
        const { membership, family, familyConfig } = res.data;
        return Response.json({
          success: true,
          membership: membership ? {
            id: membership.id,
            family_id: membership.family_id,
            role: membership.role,
          } : null,
          family: family ? {
            id: family.id,
            name: family.name,
          } : null,
          familyConfig: familyConfig ? {
            currency: familyConfig.currency,
          } : null,
        });
      } else {
        return Response.json({
          error: 'getMyMembership returned non-200',
          status: res.status,
          data: res.data,
        }, { status: 500 });
      }
    } catch (err) {
      console.error('Error calling getMyMembership:', err);
      return Response.json({
        error: 'Failed to call getMyMembership',
        details: err.message,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Outer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});