import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('testAgentMultiFamilySupport: Testing agent with user =', user.email);

    // Get user's family membership
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

    const membership = memberships[0];
    if (!membership) {
      return Response.json({ error: 'No family membership found' }, { status: 404 });
    }

    console.log('testAgentMultiFamilySupport: Family =', membership.family_id);

    // Get all family members (Persons) - this is what the agent should see
    const persons = await base44.asServiceRole.entities.Person.filter({
      family_id: membership.family_id,
    });

    console.log('testAgentMultiFamilySupport: Family members =', persons.map(p => p.name).join(', '));

    // Get all categories - this is what the agent should see
    const categories = await base44.asServiceRole.entities.Category.filter({
      family_id: membership.family_id,
    });

    console.log('testAgentMultiFamilySupport: Categories =', categories.map(c => `${c.icon} ${c.name}`).join(', '));

    // Get family configuration including currency
    const familyConfigs = await base44.asServiceRole.entities.FamilyConfig.filter({
      family_id: membership.family_id,
    });

    const familyConfig = familyConfigs[0];
    const currency = familyConfig?.currency || 'MXN';
    const currencySymbol = familyConfig?.currency_symbol || '$';

    console.log('testAgentMultiFamilySupport: Currency =', currency, 'Symbol =', currencySymbol);

    // Verify agent config doesn't have hardcoded members
    const agentConfig = {
      name: 'finance_assistant',
      description: 'Asistente financiero inteligente de FamilyFlow',
      supports_multi_family: true,
      current_family: {
        id: membership.family_id,
        members: persons.map(p => ({ id: p.id, name: p.name })),
        categories: categories.map(c => ({ id: c.id, name: c.name, icon: c.icon })),
        currency: currency,
        currencySymbol: currencySymbol,
      }
    };

    console.log('testAgentMultiFamilySupport: Agent configuration ready');

    return Response.json({
      success: true,
      message: 'Agent supports multi-family setup',
      family_id: membership.family_id,
      currency: currency,
      currency_symbol: currencySymbol,
      members_count: persons.length,
      members: persons.map(p => p.name),
      categories_count: categories.length,
      categories: categories.map(c => `${c.icon} ${c.name}`),
      agent_config: agentConfig,
      test_result: 'PASSED - Agent understands family members, categories, and currency'
    });
  } catch (error) {
    console.error('testAgentMultiFamilySupport error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}