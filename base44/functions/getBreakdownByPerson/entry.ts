import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function fetchAllTransactions(entities, { familyId, start, end }) {
  const PAGE = 200;
  let all = [];
  let skip = 0;
  let truncated = false;
  const filter = { family_id: familyId };
  if (start) filter.date = { ...filter.date, $gte: start };
  if (end) filter.date = { ...filter.date, $lte: end };

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
    const { familyId, start, end } = body;
    if (!familyId) return Response.json({ error: 'familyId required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const [{ transactions, truncated }, personsArr] = await Promise.all([
      fetchAllTransactions(entities, { familyId, start, end }),
      entities.Person.filter({ family_id: familyId }),
    ]);

    const personMap = new Map((personsArr || []).map((p) => [p.id, p.name ?? p.id]));
    const personAgg = new Map();

    for (const tx of transactions) {
      if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
      const key = tx.person_id ?? '__none__';
      const entry = personAgg.get(key) ?? { expense: 0, income: 0, count: 0 };
      if (tx.type === 'expense') entry.expense += tx.amount;
      else if (tx.type === 'income') entry.income += tx.amount;
      entry.count++;
      personAgg.set(key, entry);
    }

    const groups = Array.from(personAgg.entries())
      .map(([pid, agg]) => ({
        person_id: pid === '__none__' ? null : pid,
        name: pid === '__none__' ? 'Sin persona' : (personMap.get(pid) ?? pid),
        expense: agg.expense,
        income: agg.income,
        count: agg.count,
      }))
      .sort((a, b) => b.expense - a.expense);

    return Response.json({ period: { start: start ?? null, end: end ?? null }, groups, truncated });
  } catch (error) {
    console.error('getBreakdownByPerson error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
});