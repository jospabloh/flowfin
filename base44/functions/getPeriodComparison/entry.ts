import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function fetchTotals(entities, familyId, start, end, type) {
  const filter = { family_id: familyId };
  if (start) filter.date = { ...filter.date, $gte: start };
  if (end) filter.date = { ...filter.date, $lte: end };
  if (type && type !== 'all') filter.type = type;

  let all = [], skip = 0, truncated = false;
  while (true) {
    const page = await entities.Transaction.filter(filter, '-date', 200, skip);
    all = all.concat(page || []);
    if (!page || page.length < 200) break;
    skip += 200;
    if (all.length >= 2000) { truncated = true; break; }
  }

  let expense = 0, income = 0;
  for (const tx of all) {
    if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
    if (tx.type === 'expense') expense += tx.amount;
    else if (tx.type === 'income') income += tx.amount;
  }
  return { total: { expense, income, balance: income - expense }, truncated };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { familyId, currentStart, currentEnd, previousStart, previousEnd, type = 'expense' } = body;
    if (!familyId) return Response.json({ error: 'familyId required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const [current, previous] = await Promise.all([
      fetchTotals(entities, familyId, currentStart, currentEnd, type),
      fetchTotals(entities, familyId, previousStart, previousEnd, type),
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
});