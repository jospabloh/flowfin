import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Returns the family's catalogs for Finia to map names → ids.
// Resolves family_id entirely from the authenticated session.
// Never accepts family_id from the client.
// IMPORTANT: Use base44.entities (user-context) for family-scoped reads.
// asServiceRole does NOT bypass RLS for these entities in the function runtime.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // asServiceRole works for FamilyMembership (has user.id / user.email RLS paths)
    const srEntities = base44.asServiceRole.entities;
    // user-context for all family-scoped entities
    const userEntities = base44.entities;

    let memberships = await srEntities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) memberships = await srEntities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    if (!memberships.length) return Response.json({ error: 'forbidden' }, { status: 403 });

    const activeId = user.data?.family_id ?? user.data?.data?.family_id;
    const membership = memberships.find(m => m.family_id === activeId)
      ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
    const familyId = membership.family_id;

    console.log('[finiaGetCatalogs] familyId:', familyId);

    const [persons, categories, subcategories, paymentMethods] = await Promise.all([
      userEntities.Person.filter({ family_id: familyId }),
      userEntities.Category.filter({ family_id: familyId }),
      userEntities.Subcategory.filter({ family_id: familyId }),
      userEntities.PaymentMethod.filter({ family_id: familyId }),
    ]);

    console.log('[finiaGetCatalogs] persons:', persons.length, 'categories:', categories.length);

    return Response.json({
      self_person_id: membership.person_id ?? null,
      persons: (persons || []).map(p => ({ id: p.id, name: p.name })),
      categories: (categories || []).map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        icon: c.icon,
        exclude_from_totals: c.exclude_from_totals ?? false,
      })),
      subcategories: (subcategories || []).map(s => ({
        id: s.id,
        name: s.name,
        category_id: s.category_id,
      })),
      payment_methods: (paymentMethods || []).map(m => ({
        id: m.id,
        name: m.name,
        type: m.type,
      })),
    });
  } catch (error) {
    console.error('finiaGetCatalogs error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});