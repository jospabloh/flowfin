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
      if (nameFallback) {
        const n = norm(nameFallback);
        m = list.find(x => norm(x.name) === n);
        if (m) return m;
        m = list.find(x => norm(x.name).includes(n) || n.includes(norm(x.name)));
        if (m) return m;
        const words = n.split(/\s+/).filter(w => w.length > 2);
        m = list.find(x => words.some(w => norm(x.name).includes(w)));
        if (m) return m;
      }
      return null;
    };

    // Semantic keyword map for category inference when ID and name both fail
    const SEMANTIC_MAP = {
      'aliment': ['alimentacion', 'comida', 'food'],
      'transport': ['transporte', 'gasolina', 'auto', 'coche', 'uber', 'taxi'],
      'salud': ['salud', 'medico', 'doctor', 'farmacia', 'medicina'],
      'educac': ['educacion', 'colegio', 'escuela', 'colegiatura'],
      'hogar': ['hogar', 'casa', 'renta', 'limpieza'],
      'entretenimiento': ['entretenimiento', 'ocio', 'cine', 'streaming'],
      'ropa': ['ropa', 'vestimenta', 'zapatos'],
      'salidas': ['salidas', 'restaurante', 'bar', 'café', 'cafe'],
    };

    const semanticFind = (list, nameHint, _txType) => {
      if (!nameHint) return null;
      const n = norm(nameHint);
      // Try each semantic group
      for (const [key, aliases] of Object.entries(SEMANTIC_MAP)) {
        const matches = aliases.some(a => n.includes(a) || a.includes(n));
        if (matches) {
          // Find category in list matching this semantic group
          const found = list.find(x => {
            const xn = norm(x.name);
            return aliases.some(a => xn.includes(a) || a.includes(xn)) || xn.includes(key);
          });
          if (found) return found;
        }
      }
      return null;
    };

    // Fetch ALL categories for this family using user-scoped entities (RLS-aware)
    const [allCats, allPersons] = await Promise.all([
      userEntities.Category.filter({ family_id: familyId }),
      userEntities.Person.filter({ family_id: familyId }),
    ]);

    console.log(`[finiaConfirmTransaction] family=${familyId} cats=${allCats?.length} persons=${allPersons?.length} category_id=${category_id} category_name=${body.category_name}`);

    let catCheck = fuzzyFind(allCats || [], category_id, body.category_name);
    // Last resort: semantic inference from name hint
    if (!catCheck && body.category_name) {
      catCheck = semanticFind(allCats || [], body.category_name, type);
    }
    // Absolute last resort: if description/concept mentions food words, try to find food category
    if (!catCheck && description) {
      catCheck = semanticFind(allCats || [], description, type);
    }

    const personCheck = fuzzyFind(allPersons || [], person_id, body.person_name);

    if (!catCheck) {
      const catNames = (allCats || []).map(c => c.name).join(', ');
      return Response.json({
        error: `No encontré la categoría en tu catálogo. Categorías disponibles: ${catNames}. Intenta indicar el nombre exacto de una de estas categorías.`,
        detail: `category_id: ${category_id}, category_name: ${body.category_name}`,
        available_categories: (allCats || []).map(c => ({ id: c.id, name: c.name }))
      }, { status: 400 });
    }
    if (!personCheck) {
      const personNames = (allPersons || []).map(p => p.name).join(', ');
      return Response.json({
        error: `No encontré la persona en tu catálogo. Personas disponibles: ${personNames}.`,
        detail: `person_id: ${person_id}, person_name: ${body.person_name}`,
        available_persons: (allPersons || []).map(p => ({ id: p.id, name: p.name }))
      }, { status: 400 });
    }

    // Use resolved IDs (fuzzy match may have corrected them)
    const resolvedCategoryId = catCheck.id;
    const resolvedPersonId = personCheck.id;

    let resolvedSubcategoryId = subcategory_id ?? null;
    if (subcategory_id) {
      const allSubs = await userEntities.Subcategory.filter({ family_id: familyId });
      const subCheck = fuzzyFind(allSubs || [], subcategory_id, body.subcategory_name);
      resolvedSubcategoryId = subCheck ? subCheck.id : null;
    }

    let resolvedPaymentMethodId = payment_method_id ?? null;
    if (payment_method_id) {
      const allPMs = await userEntities.PaymentMethod.filter({ family_id: familyId });
      const pmCheck = fuzzyFind(allPMs || [], payment_method_id, body.payment_method_name);
      resolvedPaymentMethodId = pmCheck ? pmCheck.id : null;
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

    await userEntities.Transaction.create(txData);

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