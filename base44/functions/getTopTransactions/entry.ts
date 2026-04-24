import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { familyId, start, end, type = 'expense', N = 10, personId } = body;
    if (!familyId) return Response.json({ error: 'familyId required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;

    const filter = { family_id: familyId };
    if (start) filter.date = { ...filter.date, $gte: start };
    if (end) filter.date = { ...filter.date, $lte: end };
    if (type && type !== 'all') filter.type = type;
    if (personId) filter.person_id = personId;

    const [txArr, categoriesArr, personsArr] = await Promise.all([
      entities.Transaction.filter(filter, '-amount', 200),
      entities.Category.filter({ family_id: familyId }),
      entities.Person.filter({ family_id: familyId }),
    ]);

    const catMap = new Map((categoriesArr || []).map((c) => [c.id, c.name ?? c.id]));
    const personMap = new Map((personsArr || []).map((p) => [p.id, p.name ?? p.id]));

    const items = (txArr || [])
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
      .slice(0, N)
      .map((tx) => ({
        id: tx.id,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        description: tx.description || '—',
        category_name: tx.category_id ? (catMap.get(tx.category_id) ?? null) : null,
        person_name: tx.person_id ? (personMap.get(tx.person_id) ?? null) : null,
      }));

    return Response.json({ period: { start: start ?? null, end: end ?? null }, type, items });
  } catch (error) {
    console.error('getTopTransactions error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
});