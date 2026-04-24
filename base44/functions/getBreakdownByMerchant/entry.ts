import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function normalizeMerchant(desc) {
  if (!desc) return '(sin descripción)';
  return desc.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
}

async function fetchAllTransactions(entities, { familyId, start, end, type }) {
  const PAGE = 200;
  let all = [];
  let skip = 0;
  let truncated = false;
  const filter = { family_id: familyId };
  if (start) filter.date = { ...filter.date, $gte: start };
  if (end) filter.date = { ...filter.date, $lte: end };
  if (type && type !== 'all') filter.type = type;

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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { familyId, start, end, type = 'expense', topN = 10 } = body;
    if (!familyId) return Response.json({ error: 'familyId required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const { transactions, truncated } = await fetchAllTransactions(entities, { familyId, start, end, type });

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