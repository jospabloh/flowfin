import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Saves a confirmed ScheduledPayment (recurring monthly charge) draft.
// Re-validates auth, family membership, and all referenced IDs server-side.
// This is the ONLY function that writes ScheduledPayments for Finia.
//
// Writes via userEntities (not asServiceRole) so RLS is enforced under the
// calling user's own role — Finia can create exactly what that user's role
// already permits them to create by hand in Pagos Programados, nothing more.
//
// Safety default: automation_mode is always created as 'manual'. Finia never
// enables autopost (automatic money movement) on the user's behalf — that's
// a deliberate, separate opt-in the user makes from Pagos Programados.
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
    const { name, amount, due_day, type, category_id, payment_method_id, description, icon } = body;

    let person_id = body.person_id;
    if (!person_id || person_id === 'self') person_id = membership.person_id ?? null;

    // Only name + due_day are actually required by the ScheduledPayment
    // entity — amount/category/payment_method are legitimately optional
    // (e.g. a variable electric bill with no fixed amount yet).
    const missing = [];
    if (!name || !String(name).trim()) missing.push('name');
    if (due_day === undefined || due_day === null) missing.push('due_day');
    if (missing.length) {
      return Response.json({ error: 'missing_required_fields', fields: missing }, { status: 400 });
    }

    const dueDayNum = Number(due_day);
    if (!Number.isInteger(dueDayNum) || dueDayNum < 1 || dueDayNum > 28) {
      return Response.json({ error: 'invalid_due_day' }, { status: 400 });
    }

    const resolvedType = type === 'income' ? 'income' : 'expense';

    if (amount !== undefined && amount !== null) {
      if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
        return Response.json({ error: 'invalid_amount' }, { status: 400 });
      }
    }

    // Normalize + fuzzy match, same approach as finiaConfirmTransaction
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

    const allCats = await userEntities.Category.filter({ family_id: familyId });

    let resolvedCategoryId = null;
    if (category_id) {
      const catCheck = fuzzyFind(allCats || [], category_id, body.category_name);
      resolvedCategoryId = catCheck ? catCheck.id : null;
    }

    let resolvedPersonId = null;
    if (person_id) {
      const allPersons = await userEntities.Person.filter({ family_id: familyId });
      const personCheck = fuzzyFind(allPersons || [], person_id, body.person_name);
      resolvedPersonId = personCheck ? personCheck.id : null;
    }

    let resolvedPaymentMethodId = null;
    if (payment_method_id) {
      const allPMs = await userEntities.PaymentMethod.filter({ family_id: familyId });
      const pmCheck = fuzzyFind(allPMs || [], payment_method_id, body.payment_method_name);
      resolvedPaymentMethodId = pmCheck ? pmCheck.id : null;
    }

    const spData = {
      family_id: familyId,
      name: String(name).trim().slice(0, 100),
      due_day: dueDayNum,
      type: resolvedType,
      is_active: true,
      automation_mode: 'manual', // Finia never auto-enables autopost — see header note.
      autopost_enabled: false,
      icon: (icon && String(icon).trim()) || '💰',
    };
    if (description) spData.description = String(description).slice(0, 200);
    if (amount !== undefined && amount !== null) spData.amount = amount;
    if (resolvedCategoryId) spData.category_id = resolvedCategoryId;
    if (resolvedPersonId) spData.person_id = resolvedPersonId;
    if (resolvedPaymentMethodId) spData.payment_method_id = resolvedPaymentMethodId;

    await userEntities.ScheduledPayment.create(spData);

    return Response.json({
      ok: true,
      message: '✅ Pago programado creado correctamente. Por seguridad quedó en modo manual — puedes activar el domiciliado automático desde Pagos Programados si quieres que se registre solo.',
      scheduled_payment: {
        name: spData.name,
        due_day: spData.due_day,
        amount: spData.amount ?? null,
        type: spData.type,
      },
    });
  } catch (error) {
    console.error('finiaConfirmScheduledPayment error:', error?.message ?? error);
    return Response.json({ error: 'internal', detail: error?.message }, { status: 500 });
  }
});
