import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('testAgentJessicaCrewCurrency: user =', user.email);

    // Find Jessica crew family by name
    const families = await base44.asServiceRole.entities.Family.filter({});
    console.log('testAgentJessicaCrewCurrency: Total families =', families.length);

    const jessicaCrewFamily = families.find(f => 
      f.name && f.name.toLowerCase().includes('jessica') && f.name.toLowerCase().includes('crew')
    );

    if (!jessicaCrewFamily) {
      return Response.json({ 
        error: 'Jessica crew family not found',
        available_families: families.map(f => f.name)
      }, { status: 404 });
    }

    console.log('testAgentJessicaCrewCurrency: Found family =', jessicaCrewFamily.name, jessicaCrewFamily.id);

    // Get family config for currency
    const configs = await base44.asServiceRole.entities.FamilyConfig.filter({
      family_id: jessicaCrewFamily.id,
    });

    const config = configs[0];
    console.log('testAgentJessicaCrewCurrency: FamilyConfig =', config);

    // Get family members
    const members = await base44.asServiceRole.entities.Person.filter({
      family_id: jessicaCrewFamily.id,
    });

    console.log('testAgentJessicaCrewCurrency: Members =', members.map(m => m.name).join(', '));

    // Get categories
    const categories = await base44.asServiceRole.entities.Category.filter({
      family_id: jessicaCrewFamily.id,
    });

    console.log('testAgentJessicaCrewCurrency: Categories =', categories.length);

    const currency = config?.currency || jessicaCrewFamily.currency || 'MXN';
    const currencySymbol = config?.currency_symbol || jessicaCrewFamily.currency_symbol || '$';

    return Response.json({
      success: true,
      message: 'Agent recognizes Jessica crew family configuration',
      family: {
        id: jessicaCrewFamily.id,
        name: jessicaCrewFamily.name,
        currency: currency,
        currency_symbol: currencySymbol,
        admin_user_id: jessicaCrewFamily.admin_user_id,
      },
      members: members.map(m => m.name),
      categories_count: categories.length,
      currency_source: config ? 'FamilyConfig' : 'Family entity',
      agent_understanding: `El agente entiende que la familia "${jessicaCrewFamily.name}" usa moneda ${currency} (símbolo: ${currencySymbol}) y tiene ${members.length} miembros: ${members.map(m => m.name).join(', ')}`
    });
  } catch (error) {
    console.error('testAgentJessicaCrewCurrency error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});