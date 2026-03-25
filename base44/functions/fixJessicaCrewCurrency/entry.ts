import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Verify admin access
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all families to find Jessica crew
    const families = await base44.asServiceRole.entities.Family.filter({});
    const jessicaCrewFamily = families.find(f => 
      f.name && f.name.toLowerCase().includes('jessica') && f.name.toLowerCase().includes('crew')
    );

    if (!jessicaCrewFamily) {
      return Response.json({ error: 'Jessica crew family not found' }, { status: 404 });
    }

    console.log('fixJessicaCrewCurrency: Fixing family =', jessicaCrewFamily.name);

    // Get FamilyConfig
    const configs = await base44.asServiceRole.entities.FamilyConfig.filter({
      family_id: jessicaCrewFamily.id,
    });

    if (!configs.length) {
      return Response.json({ error: 'No FamilyConfig found for this family' }, { status: 404 });
    }

    const config = configs[0];

    // Update with correct currency
    console.log('fixJessicaCrewCurrency: Updating config ID =', config.id);
    
    await base44.asServiceRole.entities.FamilyConfig.update(config.id, {
      currency: 'CRC',
      currency_symbol: '₡',
      locale: 'es-CR',
    });

    console.log('fixJessicaCrewCurrency: Update successful');

    // Verify
    const updated = await base44.asServiceRole.entities.FamilyConfig.filter({
      family_id: jessicaCrewFamily.id,
    });

    const verifyConfig = updated[0];

    return Response.json({
      success: true,
      message: 'Jessica crew currency fixed',
      family_name: jessicaCrewFamily.name,
      before: {
        currency: 'MXN',
        symbol: '$',
        locale: 'es-MX',
      },
      after: {
        currency: verifyConfig.currency,
        symbol: verifyConfig.currency_symbol,
        locale: verifyConfig.locale,
      },
      status: verifyConfig.currency === 'CRC' ? 'FIXED ✅' : 'FAILED ❌'
    });
  } catch (error) {
    console.error('fixJessicaCrewCurrency error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});