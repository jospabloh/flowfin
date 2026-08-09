import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Saves a confirmed split-expense draft as N separate Transaction rows (one
// per person's share), sharing a split_group_id so the UI can group them.
// This is the ONLY function that writes split expenses for Finia.
//
// Writes via userEntities (not asServiceRole) so RLS is enforced under the
// calling user's own role, same as finiaConfirmTransaction.
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
    const { amount_total, type, date, description, category_id, subcategory_id, payment_method_id, splits } = body;

    const missing = [];
    if (amount_total === undefined || amount_total === null) missing.push('amount_total');
    if (!type) missing.push('type');
    if (!date) missing.push('date');
    if (!category_id) missing.push('category_id');
    if (!Array.isArray(splits) || splits.length < 2) missing.push('splits');
    if (missing.length) {
      return Response.json({ error: 'missing_required_fields', fields: missing }, { status: 400 });
    }

    if (typeof amount_total !== 'number' || !isFinite(amount_total) || amount_total <= 0) {
      return Response.json({ error: 'invalid_amount' }, { status: 400 });
    }
    if (type !== 'expense' && type !== 'income') {
      return Response.json({ error: 'invalid_type' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: 'invalid_date' }, { status: 400 });
    }
    for (const s of splits) {
      if (!s.person_id || typeof s.amount !== 'number' || !isFinite(s.amount) || s.amount <= 0) {
        return Response.json({ error: 'invalid_split', detail: s }, { status: 400 });
      }
    }
    const splitsSum = splits.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(splitsSum - amount_total) > 0.01) {
      return Response.json({ error: 'splits_do_not_sum_to_total', splitsSum, amount_total }, { status: 400 });
    }

    const norm = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const fuzzyFind = (list, id, nameFallback) => {
      let m = list.find(x => x.id === id);
      if (m) return m;
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
    const semanticFind = (list, nameHint) => {
      if (!nameHint) return null;
      const n = norm(nameHint);
      for (const [key, aliases] of Object.entries(SEMANTIC_MAP)) {
        if (aliases.some(a => n.includes(a) || a.includes(n))) {
          const found = list.find(x => {
            const xn = norm(x.name);
            return aliases.some(a => xn.includes(a) || a.includes(xn)) || xn.includes(key);
          });
          if (found) return found;
        }
      }
      return null;
    };

    const [allCats, allPersons] = await Promise.all([
      userEntities.Category.filter({ family_id: familyId }),
      userEntities.Person.filter({ family_id: familyId }),
    ]);

    let catCheck = fuzzyFind(allCats || [], category_id, body.category_name);
    if (!catCheck && body.category_name) catCheck = semanticFind(allCats || [], body.category_name);
    if (!catCheck && description) catCheck = semanticFind(allCats || [], description);
    if (!catCheck) {
      const catNames = (allCats || []).map(c => c.name).join(', ');
      return Response.json({
        error: `No encontré la categoría en tu catálogo. Categorías disponibles: ${catNames}.`,
        available_categories: (allCats || []).map(c => ({ id: c.id, name: c.name })),
      }, { status: 400 });
    }

    // Resolve each split's person against the real catalog — a stale/guessed
    // person_id from the draft must not silently create an orphaned row.
    const resolvedSplits = [];
    for (const s of splits) {
      const personCheck = fuzzyFind(allPersons || [], s.person_id, s.person_name);
      if (!personCheck) {
        const personNames = (allPersons || []).map(p => p.name).join(', ');
        return Response.json({
          error: `No encontré a "${s.person_name || s.person_id}" en tu catálogo de personas. Personas disponibles: ${personNames}.`,
          available_persons: (allPersons || []).map(p => ({ id: p.id, name: p.name })),
        }, { status: 400 });
      }
      resolvedSplits.push({ person: personCheck, amount: s.amount });
    }

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

    // crypto.randomUUID() is available in the Deno runtime — groups the N
    // rows this split creates without needing a separate join entity.
    const splitGroupId = crypto.randomUUID();
    const baseDescription = description ? String(description).slice(0, 200) : undefined;

    const created = [];
    for (const { person, amount } of resolvedSplits) {
      const txData = {
        family_id: familyId,
        amount,
        type,
        date,
        category_id: catCheck.id,
        person_id: person.id,
        split_group_id: splitGroupId,
        split_total_amount: amount_total,
      };
      if (baseDescription) txData.description = baseDescription;
      if (resolvedSubcategoryId) txData.subcategory_id = resolvedSubcategoryId;
      if (resolvedPaymentMethodId) txData.payment_method_id = resolvedPaymentMethodId;
      await userEntities.Transaction.create(txData);
      created.push({ person_name: person.name, amount });
    }

    return Response.json({
      ok: true,
      message: `✅ Listo, dividí el gasto en ${created.length} movimientos.`,
      splits: created,
      category_name: catCheck.name,
      amount_total,
    });
  } catch (error) {
    console.error('finiaConfirmSplitExpense error:', error?.message ?? error);
    return Response.json({ error: 'internal', detail: error?.message }, { status: 500 });
  }
});
