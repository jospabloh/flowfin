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

async function fetchTotals(base44, familyId, start, end, type, personId) {
  const all = await fetchFamilyTransactions(base44, { familyId, start, end, type, personId });

  let expense = 0, income = 0;
  for (const tx of all) {
    if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
    if (tx.type === 'expense') expense += tx.amount;
    else if (tx.type === 'income') income += tx.amount;
  }
  return { total: { expense, income, balance: income - expense }, truncated: all.length >= 50000 };
}

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { currentStart, currentEnd, previousStart, previousEnd, type = 'expense' } = body;

    let access;
    try {
      access = await resolveAccess(base44, body.familyId);
    } catch (err) {
      return errorResponse(err);
    }
    const familyId = access.familyId;
    const personId = resolvePersonFilter(access, { personId: body.personId, scope: body.scope });

    const [current, previous] = await Promise.all([
      fetchTotals(base44, familyId, currentStart, currentEnd, type, personId),
      fetchTotals(base44, familyId, previousStart, previousEnd, type, personId),
    ]);

    const currAmt = current.total.expense;
    const prevAmt = previous.total.expense;
    const abs = currAmt - prevAmt;
    const pct = prevAmt > 0 ? (abs / prevAmt) * 100 : null;

    return Response.json({
      current,
      previous,
      delta: { abs, pct, direction: abs >= 0 ? 'up' : 'down' },
    });
  } catch (error) {
    console.error('getPeriodComparison error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
}