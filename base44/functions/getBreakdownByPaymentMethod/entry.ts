import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { fetchFamilyTransactions } from '../_txAggregateHelper.ts';

async function resolveAccess(base44, requestedFamilyId) {
  let user = null;
  try { user = await base44.auth.me(); } catch { user = null; }
  if (user) {
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    if (!memberships.length) { const err = new Error('forbidden'); err.httpStatus = 403; throw err; }
    let membership = memberships[0];
    if (!requestedFamilyId && memberships.length > 1) {
      const activeId = user.data?.family_id ?? user.data?.data?.family_id;
      membership = memberships.find(m => m.family_id === activeId) ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
    }
    if (requestedFamilyId) {
      const match = memberships.find(m => m.family_id === requestedFamilyId);
      if (!match) { const err = new Error('forbidden'); err.httpStatus = 403; throw err; }
      membership = match;
    }
    return { user, familyId: membership.family_id, selfPersonId: membership.person_id ?? null, membership };
  }
  if (!requestedFamilyId) { const err = new Error('whatsapp_session_expired'); err.httpStatus = 401; err.code = 'not_linked'; throw err; }
  return { user: null, familyId: requestedFamilyId, selfPersonId: null, membership: null };
}

function resolvePersonFilter(access, opts) {
  const personId = opts.personId?.trim();
  const scope = opts.scope?.trim().toLowerCase();
  if (personId && personId !== 'self') return personId;
  if (personId === 'self' || scope === 'self' || scope === 'me' || scope === 'mine') return access.selfPersonId ?? undefined;
  return undefined;
}

function errorResponse(err) {
  const status = (err && err.httpStatus) || 500;
  const message = status === 500 ? 'internal' : err?.message || 'error';
  return Response.json({ error: message }, { status });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { start, end, type = 'expense' } = body;

    let access;
    try {
      access = await resolveAccess(base44, body.familyId);
    } catch (err) {
      return errorResponse(err);
    }
    const familyId = access.familyId;
    const personId = resolvePersonFilter(access, { personId: body.personId, scope: body.scope });

    const transactions = await fetchFamilyTransactions(base44, { familyId, start, end, type, personId });

    const filtered = type === 'all' ? transactions : transactions.filter(t => t.type === type);

    // Aggregate by payment method
    const pmAgg = new Map();
    for (const tx of filtered) {
      const key = tx.payment_method_id ?? '__none__';
      const entry = pmAgg.get(key) ?? { total: 0, count: 0 };
      entry.total += tx.amount || 0;
      entry.count++;
      pmAgg.set(key, entry);
    }

    // Fetch payment method names
    const paymentMethods = await base44.asServiceRole.entities.PaymentMethod.filter({ family_id: familyId });
    const pmMap = new Map((paymentMethods || []).map(pm => [pm.id, pm.name ?? pm.id]));

    const groups = Array.from(pmAgg.entries())
      .map(([key, agg]) => ({
        payment_method_id: key === '__none__' ? null : key,
        name: key === '__none__' ? 'Sin forma de pago' : (pmMap.get(key) ?? key),
        total: agg.total,
        count: agg.count,
      }))
      .sort((a, b) => b.total - a.total);

    return Response.json({ period: { start: start ?? null, end: end ?? null }, type, groups, truncated: transactions.length >= 50000 });
  } catch (error) {
    console.error('getBreakdownByPaymentMethod error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});