import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Guard helpers — inlined (no local imports in Deno deploy)

async function resolveFamily(base44, user) {
  const sr = base44.asServiceRole.entities;
  let memberships = await sr.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
  if (!memberships.length) memberships = await sr.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
  if (!memberships.length) throw Object.assign(new Error('No tienes acceso a ninguna familia activa.'), { httpStatus: 403 });
  const activeId = user.data?.family_id ?? user.data?.data?.family_id;
  const membership = memberships.find(m => m.family_id === activeId)
    ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
  return { familyId: membership.family_id, selfPersonId: membership.person_id ?? null };
}

// Verify a referenced entity belongs to this family using user-context
async function assertRefInFamily(userEntities, entity, id, familyId, label) {
  const rows = await userEntities[entity].filter({ id, family_id: familyId });
  if (!rows || !rows.length) {
    throw Object.assign(new Error(`${label} no pertenece a tu familia o no existe.`), { httpStatus: 400 });
  }
}

// Creates ONE transaction for the caller's family. Identity is enforced server-side;
// the family_id is never taken from the caller.
// IMPORTANT: Use base44.entities (user-context) for family-scoped reads.
// asServiceRole does NOT bypass RLS for these entities in the function runtime.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { familyId, selfPersonId } = await resolveFamily(base44, user);
    const ue = base44.entities;

    const body = await req.json().catch(() => ({}));
    const {
      amount, type, date, description, category_id, subcategory_id,
      payment_method_id,
    } = body;

    let person_id = body.person_id;
    if (!person_id || person_id === 'self') person_id = selfPersonId;

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
      return Response.json({ error: 'invalid_amount', message: 'amount must be a positive number' }, { status: 400 });
    }
    if (type !== 'expense' && type !== 'income') {
      return Response.json({ error: 'invalid_type', message: 'type must be expense or income' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: 'invalid_date', message: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    // Validate refs using user-context
    await Promise.all([
      assertRefInFamily(ue, 'Category', category_id, familyId, 'La categoría'),
      assertRefInFamily(ue, 'Person', person_id, familyId, 'La persona'),
      subcategory_id ? assertRefInFamily(ue, 'Subcategory', subcategory_id, familyId, 'La subcategoría') : Promise.resolve(),
      payment_method_id ? assertRefInFamily(ue, 'PaymentMethod', payment_method_id, familyId, 'El método de pago') : Promise.resolve(),
    ]);

    const txData = {
      family_id: familyId,
      amount,
      type,
      date,
      category_id,
      person_id,
    };
    if (description !== undefined && description !== null) txData.description = description;
    if (subcategory_id) txData.subcategory_id = subcategory_id;
    if (payment_method_id) txData.payment_method_id = payment_method_id;

    // Create via user-context so RLS is satisfied
    const created = await ue.Transaction.create(txData);
    return Response.json({ ok: true, id: created.id });
  } catch (error) {
    const status = error.httpStatus || 500;
    console.error('agentCreateTransaction error:', error);
    return Response.json({ error: error.message || 'internal' }, { status });
  }
});