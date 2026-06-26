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

function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { categoryId, start, end, type = 'expense' } = body;

    let access;
    try {
      access = await resolveAccess(base44, body.familyId);
    } catch (err) {
      return errorResponse(err);
    }
    const familyId = access.familyId;
    const personId = resolvePersonFilter(access, { personId: body.personId, scope: body.scope });

    if (!start || !end || new Date(start) > new Date(end)) {
      return Response.json({ error: 'invalid date range' }, { status: 400 });
    }

    const transactions = await fetchFamilyTransactions(base44, {
      familyId, start, end, categoryId, type, personId,
    });
    const truncated = transactions.length >= 50000;

    const filtered = type === 'all' ? transactions : transactions.filter(t => t.type === type);
    const amounts = filtered.map(t => t.amount || 0).sort((a, b) => a - b);
    const count = amounts.length;

    // Fetch category name
    const categories = await base44.asServiceRole.entities.Category.filter({ family_id: familyId });
    const cat = categories.find((c: { id: string; name: string }) => c.id === categoryId);
    const categoryInfo = { id: categoryId, name: cat?.name ?? null };

    if (count === 0) {
      return Response.json({
        period: { start, end },
        type,
        category: categoryInfo,
        stats: { mean: 0, stddev: 0, min: 0, max: 0, p50: 0, p90: 0, count: 0 },
        empty: true,
        truncated,
      });
    }

    const sum = amounts.reduce((s, a) => s + a, 0);
    const mean = sum / count;
    const variance = amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / count;
    const stddev = Math.sqrt(variance);
    const min = amounts.reduce((m, a) => Math.min(m, a), amounts[0]);
    const max = amounts.reduce((m, a) => Math.max(m, a), amounts[0]);
    const p50 = quantile(amounts, 0.5);
    const p90 = quantile(amounts, 0.9);

    return Response.json({
      period: { start, end },
      type,
      category: categoryInfo,
      stats: { mean, stddev, min, max, p50, p90, count },
      empty: false,
      truncated,
    });
  } catch (err) {
    console.error('getCategoryStats error:', err);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});