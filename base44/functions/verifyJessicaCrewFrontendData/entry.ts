import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('verifyJessicaCrewFrontendData: user =', user.email);

    // Simulate what FamilyContext does
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });

    if (!memberships.length) {
      memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: user.email,
        status: 'approved',
      });
    }

    if (!memberships.length) {
      return Response.json({ error: 'No membership found' }, { status: 404 });
    }

    const membership = memberships[0];
    console.log('verifyJessicaCrewFrontendData: membership.family_id =', membership.family_id);

    // Get Family
    const families = await base44.asServiceRole.entities.Family.filter({
      id: membership.family_id
    });
    const family = families[0];

    console.log('verifyJessicaCrewFrontendData: family.name =', family.name);
    console.log('verifyJessicaCrewFrontendData: family.currency =', family.currency);
    console.log('verifyJessicaCrewFrontendData: family.currency_symbol =', family.currency_symbol);

    // Get FamilyConfig (what getMyMembership returns)
    const configs = await base44.asServiceRole.entities.FamilyConfig.filter({
      family_id: membership.family_id
    });
    const familyConfig = configs[0];

    console.log('verifyJessicaCrewFrontendData: familyConfig.currency =', familyConfig?.currency);
    console.log('verifyJessicaCrewFrontendData: familyConfig.currency_symbol =', familyConfig?.currency_symbol);

    // What the frontend would use
    const currency = familyConfig?.currency || family?.currency || 'MXN';
    const currencySymbol = familyConfig?.currency_symbol || family?.currency_symbol || '$';

    console.log('verifyJessicaCrewFrontendData: FINAL currency =', currency);
    console.log('verifyJessicaCrewFrontendData: FINAL currencySymbol =', currencySymbol);

    return Response.json({
      success: true,
      user_email: user.email,
      user_family_id: user.data?.family_id,
      membership_family_id: membership.family_id,
      family: {
        id: family.id,
        name: family.name,
        currency: family.currency,
        currency_symbol: family.currency_symbol,
      },
      family_config: familyConfig ? {
        currency: familyConfig.currency,
        currency_symbol: familyConfig.currency_symbol,
      } : null,
      frontend_will_use: {
        currency: currency,
        symbol: currencySymbol,
      },
      is_correct: currency === 'CRC' && currencySymbol === '₡'
    });
  } catch (error) {
    console.error('verifyJessicaCrewFrontendData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});