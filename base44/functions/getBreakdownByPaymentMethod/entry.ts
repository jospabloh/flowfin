import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function fetchAllTransactions(base44, { familyId, start, end, type }) {
  const PAGE = 200;
  let all = [];
  let skip = 0;
  let truncated = false;
  const filter = { family_id: familyId };
  if (start) filter.date = { ...filter.date, $gte: start };
  if (end) filter.date = { ...filter.date, $lte: end };
  if (type && type !== 'all') filter.type = type;

  while (true) {
    const page = await base44.asServiceRole.entities.Transaction.filter(filter, '-date', PAGE, skip);
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
    const { familyId, start, end, type = 'expense' } = body;

    if (!familyId) return Response.json({ error: 'familyId required' }, { status: 400 });

    const { transactions, truncated } = await fetchAllTransactions(base44, { familyId, start, end, type });

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

    return Response.json({ period: { start: start ?? null, end: end ?? null }, type, groups, truncated });
  } catch (error) {
    console.error('getBreakdownByPaymentMethod error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});