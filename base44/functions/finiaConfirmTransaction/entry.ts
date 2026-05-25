import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Saves a confirmed transaction draft.
// Re-validates auth, family membership, and all referenced IDs server-side.
// This is the ONLY function that writes transactions for Finia.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const srEntities = base44.asServiceRole.entities;
    const userEntities = base44.entities;

    let memberships = await srEntities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) memberships = await srEntities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    if (!memberships.length) return Response.json({ error: 'forbidden' }, { status: 403 });

    const activeId = user.data?.family_id ?? user.data?.data?.family_id;
    const membership = memberships.find(m => m.family_id === activeId)
      ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
    const familyId = membership.family_id;

    const body = await req.json().catch(() => ({}));
    const { amount, type, date, description, category_id, subcategory_id, payment_method_id } = body;

    // person_id: default to self if not provided
    let person_id = body.person_id;
    if (!person_id || person_id === 'self') person_id = membership.person_id ?? null;

    // Validate required fields
    const missing = [];
    if (amount === undefined || amount === null) missing.push('amount');
    if (!type) missing.push('type');
    if (!date) missing.push('date');
    if (!category_id) missing.push('category_id');
    if (!person_id) missing.push('person_id');
    if (missing.length) {
      return Response.json({ error: 'missing_required_fields', fields: missing }, { status: 400 });
    }

    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return Response.json({ error: 'invalid_amount' }, { status: 400 });
    }
    if (type !== 'expense' && type !== 'income') {
      return Response.json({ error: 'invalid_type' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: 'invalid_date' }, { status: 400 });
    }

    // Normalize for fuzzy matching
    const norm = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const fuzzyFind = (list, id, nameFallback) => {
      // 1. Exact ID match
      let m = list.find(x => x.id === id);
      if (m) return m;
      // 2. Fuzzy name match (if name hint provided)
      if (!nameFallback) return null;
      const n = norm(nameFallback);
      m = list.find(x => norm(x.name) === n);
      if (m) return m;
      m = list.find(x => norm(x.name).includes(n) || n.includes(norm(x.name)));
      if (m) return m;
      const words = n.split(/\s+/).filter(w => w.length > 2);
      return list.find(x => words.some(w => norm(x.name).includes(w))) ?? null;
    };

    // Validate all referenced entities belong to this family
    const [allCats, allPersons] = await Promise.all([
      srEntities.Category.filter({ family_id: familyId }),
      srEntities.Person.filter({ family_id: familyId }),
    ]);

    const catCheck = fuzzyFind(allCats || [], category_id, body.category_name);
    const personCheck = fuzzyFind(allPersons || [], person_id, body.person_name);

    if (!catCheck) return Response.json({ error: 'La categoría no pertenece a tu familia.', detail: `category_id: ${category_id}` }, { status: 400 });
    if (!personCheck) return Response.json({ error: 'La persona no pertenece a tu familia.', detail: `person_id: ${person_id}` }, { status: 400 });

    // Use resolved IDs (fuzzy match may have corrected them)
    const resolvedCategoryId = catCheck.id;
    let resolvedPersonId = personCheck.id;

    let resolvedSubcategoryId = subcategory_id ?? null;
    if (subcategory_id) {
      const allSubs = await srEntities.Subcategory.filter({ family_id: familyId });
      const subCheck = fuzzyFind(allSubs || [], subcategory_id, body.subcategory_name);
      if (!subCheck) resolvedSubcategoryId = null; // silently drop invalid subcategory
      else resolvedSubcategoryId = subCheck.id;
    }

    let resolvedPaymentMethodId = payment_method_id ?? null;
    if (payment_method_id) {
      const allPMs = await srEntities.PaymentMethod.filter({ family_id: familyId });
      const pmCheck = fuzzyFind(allPMs || [], payment_method_id, body.payment_method_name);
      if (!pmCheck) resolvedPaymentMethodId = null; // silently drop invalid PM
      else resolvedPaymentMethodId = pmCheck.id;
    }

    const txData = {
      family_id: familyId,
      amount,
      type,
      date,
      category_id: resolvedCategoryId,
      person_id: resolvedPersonId,
    };
    if (description) txData.description = String(description).slice(0, 200);
    if (resolvedSubcategoryId) txData.subcategory_id = resolvedSubcategoryId;
    if (resolvedPaymentMethodId) txData.payment_method_id = resolvedPaymentMethodId;

    const created = await userEntities.Transaction.create(txData);

    return Response.json({
      ok: true,
      message: '✅ Movimiento registrado correctamente.',
      transaction: {
        amount,
        type,
        date,
        description: txData.description ?? null,
        category_name: catCheck.name ?? null,
        person_name: personCheck.name ?? null,
      },
    });
  } catch (error) {
    console.error('finiaConfirmTransaction error:', error?.message ?? error);
    return Response.json({ error: 'internal', detail: error?.message }, { status: 500 });
  }
});