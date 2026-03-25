import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all families to find Jessica crew
    const families = await base44.asServiceRole.entities.Family.filter({});
    const jessicaCrewFamily = families.find(f => 
      f.name && f.name.toLowerCase().includes('jessica') && f.name.toLowerCase().includes('crew')
    );

    if (!jessicaCrewFamily) {
      return Response.json({ error: 'Jessica crew family not found' }, { status: 404 });
    }

    console.log('debugJessicaCrewSettings: Family =', jessicaCrewFamily);

    // Check Family entity directly
    const familyData = {
      id: jessicaCrewFamily.id,
      name: jessicaCrewFamily.name,
      currency: jessicaCrewFamily.currency,
      currency_symbol: jessicaCrewFamily.currency_symbol,
    };

    console.log('debugJessicaCrewSettings: Family entity currency =', familyData.currency);

    // Check FamilyConfig
    const configs = await base44.asServiceRole.entities.FamilyConfig.filter({
      family_id: jessicaCrewFamily.id,
    });

    console.log('debugJessicaCrewSettings: FamilyConfig records =', configs.length);

    const config = configs[0];
    if (config) {
      console.log('debugJessicaCrewSettings: FamilyConfig =', JSON.stringify(config));
      console.log('debugJessicaCrewSettings: FamilyConfig.currency =', config.currency);
      console.log('debugJessicaCrewSettings: FamilyConfig.currency_symbol =', config.currency_symbol);
    } else {
      console.log('debugJessicaCrewSettings: No FamilyConfig found');
    }

    return Response.json({
      success: true,
      family_id: jessicaCrewFamily.id,
      family_name: jessicaCrewFamily.name,
      family_entity: familyData,
      family_config: config ? {
        id: config.id,
        family_id: config.family_id,
        currency: config.currency,
        currency_symbol: config.currency_symbol,
        locale: config.locale,
      } : null,
      issue: config?.currency !== 'CRC' ? 'FamilyConfig has wrong currency or is missing' : 'Currency is correct',
      should_be: {
        currency: 'CRC',
        symbol: '₡',
      }
    });
  } catch (error) {
    console.error('debugJessicaCrewSettings error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});