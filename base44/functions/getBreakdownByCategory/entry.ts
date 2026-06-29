import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { fetchFamilyTransactions } from './_txAggregateHelper.ts';

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
  const err = new Error('unauthorized'); err.httpStatus = 401; throw err;
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
    const { start, end, type = 'expense', topN = 10 } = body;

    let access;
    try {
      access = await resolveAccess(base44, body.familyId);
    } catch (err) {
      return errorResponse(err);
    }
    const familyId = access.familyId;
    const personId = resolvePersonFilter(access, { personId: body.personId, scope: body.scope });

    const entities = base44.asServiceRole.entities;

    const [transactions, categoriesArr] = await Promise.all([
      fetchFamilyTransactions(base44, { familyId, start, end, type, personId }),
      entities.Category.filter({ family_id: familyId }),
    ]);

    const excludedCatIds = new Set(
      (categoriesArr || []).filter((c: Record<string, unknown>) => c.exclude_from_totals).map((c: Record<string, unknown>) => c.id as string),
    );
    const catMap = new Map((categoriesArr || []).map((c) => [c.id, c.name ?? c.id]));

    const catAgg = new Map();
    let grandTotal = 0;
    for (const tx of transactions) {
      if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
      if (tx.category_id && excludedCatIds.has(tx.category_id)) continue;
      const key = tx.category_id ?? '__none__';
      const entry = catAgg.get(key) ?? { total: 0, count: 0 };
      entry.total += tx.amount;
      entry.count++;
      catAgg.set(key, entry);
      grandTotal += tx.amount;
    }

    const groups = Array.from(catAgg.entries())
      .map(([catId, agg]) => ({
        category_id: catId === '__none__' ? null : catId,
        name: catId === '__none__' ? 'Sin categoría' : (catMap.get(catId) ?? catId),
        total: agg.total,
        count: agg.count,
        pct: grandTotal > 0 ? Math.round((agg.total / grandTotal) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, topN > 0 ? topN : 10);

    return Response.json({ period: { start: start ?? null, end: end ?? null }, type, groups, truncated: transactions.length >= 50000 });
  } catch (error) {
    console.error('getBreakdownByCategory error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
});