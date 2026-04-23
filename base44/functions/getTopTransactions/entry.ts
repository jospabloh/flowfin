import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  assertFamilyMember,
  fetchAllTransactions,
} from '../_txAggregateHelper.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { familyId, start, end, type = 'expense', personId } = body;
    let { N = 10 } = body;

    if (!familyId) return Response.json({ error: 'familyId required' }, { status: 400 });

    if (!start || !end || new Date(start) > new Date(end)) {
      return Response.json({ error: 'invalid date range' }, { status: 400 });
    }

    // Auth check before any data query
    try {
      await assertFamilyMember(base44, familyId);
    } catch {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    // Clamp N between 1 and 100
    N = Math.max(1, Math.min(100, Number(N) || 10));

    const { transactions, truncated } = await fetchAllTransactions(base44, { familyId, start, end, type, personId });

    const filtered = type === 'all' ? transactions : transactions.filter(t => t.type === type);
    const top = filtered.sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, N);

    // Resolve names — fetch persons and categories once
    const [persons, categories] = await Promise.all([
      base44.asServiceRole.entities.Person.filter({ family_id: familyId }),
      base44.asServiceRole.entities.Category.filter({ family_id: familyId }),
    ]);

    const personMap: Record<string, string> = {};
    persons.forEach((p: { id: string; name: string }) => { personMap[p.id] = p.name; });

    const categoryMap: Record<string, string> = {};
    categories.forEach((c: { id: string; name: string }) => { categoryMap[c.id] = c.name; });

    const items = top.map(t => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      description: t.description,
      person_id: t.person_id,
      person_name: t.person_id ? (personMap[t.person_id] ?? null) : null,
      category_id: t.category_id,
      category_name: t.category_id ? (categoryMap[t.category_id] ?? null) : null,
    }));

    return Response.json({
      period: { start, end },
      type,
      items,
      truncated,
    });
  } catch (err) {
    console.error('getTopTransactions error:', err);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
