import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const READABLE_ENTITIES = new Set([
  'Transaction', 'Category', 'Subcategory', 'Person', 'PaymentMethod',
  'ScheduledPayment', 'Investment', 'InvestmentPayment', 'MSI', 'MSIPayment',
  'RentalProperty', 'RentalPayment', 'Goal', 'CategoryBudget',
]);

const MAX_LIMIT = 50;

// Keeps only primitive equality filters (drops operators/objects/arrays) so the
// query stays simple and can never escape the family scope forced below.
function flatFilter(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input)) {
    if (k.startsWith('$') || k === 'family_id') continue;
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') out[k] = v;
  }
  return out;
}

// Generic read over the caller's tenant. The server forces family_id on every
// query and restricts the entity to a read allow-list.
// IMPORTANT: Use base44.entities (user-context) for family-scoped reads.
// asServiceRole does NOT bypass RLS for these entities in the function runtime.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole.entities;
    const ue = base44.entities;

    // Resolve family from session
    let memberships = await sr.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) memberships = await sr.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    if (!memberships.length) return Response.json({ error: 'forbidden', message: 'No tienes acceso a ninguna familia.' }, { status: 403 });

    const activeId = user.data?.family_id ?? user.data?.data?.family_id;
    const membership = memberships.find(m => m.family_id === activeId)
      ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
    const familyId = membership.family_id;

    const body = await req.json().catch(() => ({}));
    const entity = String(body.entity || '');
    if (!READABLE_ENTITIES.has(entity)) {
      return Response.json({ error: 'entity_not_allowed', message: `No puedo consultar ${entity}.` }, { status: 400 });
    }

    const filter = { ...flatFilter(body.filter), family_id: familyId };
    const sort = typeof body.sort === 'string' && body.sort ? body.sort : '-created_date';
    let limit = Number(body.limit);
    if (!isFinite(limit) || limit <= 0) limit = 20;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    // Use user-context for family-scoped reads (asServiceRole returns empty)
    const rows = await ue[entity].filter(filter, sort, limit);
    return Response.json({ entity, count: (rows || []).length, items: rows || [] });
  } catch (error) {
    console.error('agentQuery error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
});