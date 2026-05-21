import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { resolveAccess, resolvePersonFilter, errorResponse } from '../_txAggregateHelper.ts';

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

    const entities = base44.asServiceRole.entities;
    const filter = { family_id: familyId };
    if (start) filter.date = { ...filter.date, $gte: start };
    if (end) filter.date = { ...filter.date, $lte: end };
    if (type && type !== 'all') filter.type = type;
    if (personId) filter.person_id = personId;

    let all = [], skip = 0;
    while (true) {
      const page = await entities.Transaction.filter(filter, '-date', 200, skip);
      all = all.concat(page || []);
      if (!page || page.length < 200) break;
      skip += 200;
      if (all.length >= 2000) break;
    }

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
});