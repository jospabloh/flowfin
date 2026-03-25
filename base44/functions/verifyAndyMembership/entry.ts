import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // First, get Andy (using service role to simulate)
    const andyUsers = await base44.asServiceRole.entities.User.filter({
      email: 'andyramirez005@gmail.com',
    });

    if (!andyUsers.length) {
      return Response.json({ error: 'Andy not found' }, { status: 404 });
    }

    const andy = andyUsers[0];
    const andyFamilyId = andy.data?.family_id;

    // Get Andy's membership
    const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: andy.id,
      status: 'approved',
    });

    if (!memberships.length) {
      return Response.json({ 
        error: 'No approved membership found for Andy',
        tried: { user_id: andy.id, status: 'approved' }
      }, { status: 404 });
    }

    const membership = memberships[0];

    // Get the family
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

    return Response.json({
      success: true,
      andy: {
        id: andy.id,
        email: andy.email,
        full_name: andy.full_name,
        dataFamilyId: andyFamilyId,
      },
      membership: {
        id: membership.id,
        family_id: membership.family_id,
        role: membership.role,
        status: membership.status,
      },
      family: {
        id: family.id,
        name: family.name,
        currency: family.currency,
        currency_symbol: family.currency_symbol,
        join_code: family.join_code,
      },
      familyConfig: familyConfig ? {
        id: familyConfig.id,
        family_name: familyConfig.family_name,
        locale: familyConfig.locale,
        currency: familyConfig.currency,
      } : null,
      allCorrect: andyFamilyId === membership.family_id && family.name === 'Jessica crew',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});