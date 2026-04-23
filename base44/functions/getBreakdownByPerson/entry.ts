import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  assertFamilyMember,
  fetchAllTransactions,
  Transaction,
} from '../_txAggregateHelper.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { familyId, start, end } = body;

    if (!familyId) {
      return Response.json({ error: 'familyId required' }, { status: 400 });
    }

    // Auth: caller must be an approved family member before any data query.
    await assertFamilyMember(base44, familyId);

    // Fetch all types to compute both expense and income per person.
    const { transactions, truncated } = await fetchAllTransactions(base44, {
      familyId,
      start,
      end,
      type: 'all',
    });

    // Aggregate per person_id: expense, income, balance, count.
    const personMap = new Map<
      string,
      { expense: number; income: number; count: number }
    >();

    for (const tx of transactions) {
      if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
      const key = tx.person_id ?? '__none__';
      const entry = personMap.get(key) ?? { expense: 0, income: 0, count: 0 };
      if (tx.type === 'expense') entry.expense += tx.amount;
      else if (tx.type === 'income') entry.income += tx.amount;
      entry.count++;
      personMap.set(key, entry);
    }

    // Single batch read for person names.
    const persons: Array<{ id: string; name?: string }> =
      await base44.asServiceRole.entities.Person.filter({ family_id: familyId });

    const personNameMap = new Map(persons.map((p) => [p.id, p.name ?? p.id]));

    const groups = Array.from(personMap.entries())
      .map(([personId, agg]) => ({
        person_id: personId === '__none__' ? null : personId,
        name: personId === '__none__' ? 'Sin persona' : (personNameMap.get(personId) ?? personId),
        expense: agg.expense,
        income: agg.income,
        balance: agg.income - agg.expense,
        count: agg.count,
      }))
      .sort((a, b) => b.expense - a.expense);

    return Response.json({
      period: { start: start ?? null, end: end ?? null },
      groups,
      truncated,
    });
  } catch (error) {
    const status = (error as Record<string, number>).httpStatus;
    if (status === 403) return Response.json({ error: 'forbidden' }, { status: 403 });
    if (status === 401) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    console.error('getBreakdownByPerson error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
