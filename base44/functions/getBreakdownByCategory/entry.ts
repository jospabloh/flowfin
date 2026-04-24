import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    const [{ transactions, truncated }, categoriesArr] = await Promise.all([
      fetchAllTransactions(entities, { familyId, start, end, type }),
      entities.Category.filter({ family_id: familyId }),
    ]);

    const catMap = new Map((categoriesArr || []).map((c) => [c.id, c.name ?? c.id]));

    const catAgg = new Map();
    let grandTotal = 0;
    for (const tx of transactions) {
      if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
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

    return Response.json({ period: { start: start ?? null, end: end ?? null }, type, groups, truncated });
  } catch (error) {
    console.error('getBreakdownByCategory error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
});