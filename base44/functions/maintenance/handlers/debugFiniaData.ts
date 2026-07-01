import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

export async function handle(req: Request, body: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const entities = base44.asServiceRole.entities;

    // 1. Get membership
    let memberships = await entities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) memberships = await entities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });

    const membership = memberships[0] ?? null;
    const familyId = membership?.family_id ?? null;

    // 2. Try to get categories two ways
    let categoriesServiceRole = [];
    let categoriesUserRole = [];
    let persons = [];
    let transactions = [];

    if (familyId) {
      try {
        categoriesServiceRole = await base44.asServiceRole.entities.Category.filter({ family_id: familyId });
      } catch (e) {
        categoriesServiceRole = { error: e.message };
      }

      try {
        categoriesUserRole = await base44.entities.Category.filter({ family_id: familyId });
      } catch (e) {
        categoriesUserRole = { error: e.message };
      }

      try {
        persons = await base44.asServiceRole.entities.Person.filter({ family_id: familyId });
      } catch (e) {
        persons = { error: e.message };
      }

      try {
        const txPage = await base44.asServiceRole.entities.Transaction.filter({ family_id: familyId }, '-date', 5);
        transactions = txPage?.length ?? 'none';
      } catch (e) {
        transactions = { error: e.message };
      }
    }

    return Response.json({
      user_id: user.id,
      user_email: user.email,
      user_data_family_id: user.data?.family_id ?? null,
      user_data_data_family_id: user.data?.data?.family_id ?? null,
      memberships_found: memberships.length,
      family_id: familyId,
      categories_service_role_count: Array.isArray(categoriesServiceRole) ? categoriesServiceRole.length : categoriesServiceRole,
      categories_user_role_count: Array.isArray(categoriesUserRole) ? categoriesUserRole.length : categoriesUserRole,
      persons_count: Array.isArray(persons) ? persons.length : persons,
      transactions_count: transactions,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
