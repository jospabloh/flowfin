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

    // Validate all referenced entities belong to this family
    // Use asServiceRole to fetch by family and then find by id in-memory (filter() doesn't support id lookup)
    const [allCats, allPersons] = await Promise.all([
      srEntities.Category.filter({ family_id: familyId }),
      srEntities.Person.filter({ family_id: familyId }),
    ]);

    const catCheck = (allCats || []).find(c => c.id === category_id);
    const personCheck = (allPersons || []).find(p => p.id === person_id);

    if (!catCheck) return Response.json({ error: 'La categoría no pertenece a tu familia.' }, { status: 400 });
    if (!personCheck) return Response.json({ error: 'La persona no pertenece a tu familia.' }, { status: 400 });

    if (subcategory_id) {
      const allSubs = await srEntities.Subcategory.filter({ family_id: familyId });
      const subCheck = (allSubs || []).find(s => s.id === subcategory_id);
      if (!subCheck) return Response.json({ error: 'La subcategoría no pertenece a tu familia.' }, { status: 400 });
    }
    if (payment_method_id) {
      const allPMs = await srEntities.PaymentMethod.filter({ family_id: familyId });
      const pmCheck = (allPMs || []).find(m => m.id === payment_method_id);
      if (!pmCheck) return Response.json({ error: 'El método de pago no pertenece a tu familia.' }, { status: 400 });
    }

    const txData = {
      family_id: familyId,
      amount,
      type,
      date,
      category_id,
      person_id,
    };
    if (description) txData.description = String(description).slice(0, 200);
    if (subcategory_id) txData.subcategory_id = subcategory_id;
    if (payment_method_id) txData.payment_method_id = payment_method_id;

    const created = await userEntities.Transaction.create(txData);

    return Response.json({
      ok: true,
      message: '✅ Movimiento registrado correctamente.',
      transaction: {
        amount,
        type,
        date,
        description: txData.description ?? null,
        category_name: catCheck[0]?.name ?? null,
        person_name: personCheck[0]?.name ?? null,
      },
    });
  } catch (error) {
    console.error('finiaConfirmTransaction error:', error?.message ?? error);
    return Response.json({ error: 'internal', detail: error?.message }, { status: 500 });
  }
});