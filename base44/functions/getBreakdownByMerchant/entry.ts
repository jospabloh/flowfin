import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { resolveAccess, resolvePersonFilter, errorResponse } from '../_txAggregateHelper.ts';

function normalizeMerchant(desc) {
  if (!desc) return '(sin descripción)';
  return desc.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
}

async function fetchAllTransactions(entities, { familyId, start, end, type, personId }) {
  const PAGE = 200;
  let all = [];
  let skip = 0;
  let truncated = false;
  const filter = { family_id: familyId };
  if (start) filter.date = { ...filter.date, $gte: start };
  if (end) filter.date = { ...filter.date, $lte: end };
  if (type && type !== 'all') filter.type = type;
  if (personId) filter.person_id = personId;

  while (true) {
    const page = await entities.Transaction.filter(filter, '-date', PAGE, skip);
    all = all.concat(page || []);
    if (!page || page.length < PAGE) break;
    skip += PAGE;
    if (all.length >= 2000) { truncated = true; break; }
  }
  return { transactions: all, truncated };
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
    const { transactions, truncated } = await fetchAllTransactions(entities, { familyId, start, end, type, personId });

    const merchantMap = new Map();
    for (const tx of transactions) {
      if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
      const merchant = normalizeMerchant(tx.description ?? '');
      const entry = merchantMap.get(merchant) ?? { total: 0, count: 0 };
      entry.total += tx.amount;
      entry.count++;
      merchantMap.set(merchant, entry);
    }

    const groups = Array.from(merchantMap.entries())
      .map(([merchant, v]) => ({ merchant, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, topN > 0 ? topN : 10);

    return Response.json({ period: { start: start ?? null, end: end ?? null }, type, groups, truncated });
  } catch (error) {
    console.error('getBreakdownByMerchant error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
});