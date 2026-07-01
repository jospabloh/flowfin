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

export async function handle(req: Request, body: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // body is provided by the analytics dispatcher parameter
    const { start, end, type = 'expense' } = body;

    let access;
    try {
      access = await resolveAccess(base44, body.familyId);
    } catch (err) {
      return errorResponse(err);
    }
    const familyId = access.familyId;
    const personId = resolvePersonFilter(access, { personId: body.personId, scope: body.scope });

    const all = await fetchFamilyTransactions(base44, { familyId, start, end, type, personId });

    const amounts = all.map((tx) => tx.amount ?? 0).filter((a) => typeof a === 'number' && !isNaN(a));
    const total = amounts.reduce((s, a) => s + a, 0);
    const count = amounts.length;

    let days = 30;
    if (start && end) {
      const ms = new Date(end).getTime() - new Date(start).getTime();
      days = Math.max(1, Math.round(ms / 86400000) + 1);
    }

    const sorted = [...amounts].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length === 0 ? 0 : sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;

    return Response.json({
      total,
      count,
      avgDaily: days > 0 ? total / days : 0,
      avgWeekly: days > 0 ? (total / days) * 7 : 0,
      avgMonthly: days > 0 ? (total / days) * 30 : 0,
      median,
    });
  } catch (error) {
    console.error('getAverages error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
}
