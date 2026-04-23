import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  assertFamilyMember,
  fetchAllTransactions,
  sumByType,
  quantile,
  daysBetween,
} from '../_txAggregateHelper.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { familyId, start, end, type = 'expense', personId } = body;

    if (!familyId) return Response.json({ error: 'familyId required' }, { status: 400 });

    // Validate date range
    if (!start || !end || new Date(start) > new Date(end)) {
      return Response.json({ error: 'invalid date range' }, { status: 400 });
    }

    // Auth check before any data query
    try {
      await assertFamilyMember(base44, familyId);
    } catch {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    const { transactions, truncated } = await fetchAllTransactions(base44, { familyId, start, end, type, personId });

    const filtered = type === 'all' ? transactions : transactions.filter(t => t.type === type);
    const { expense, income, count } = sumByType(filtered);
    const total = type === 'income' ? income : type === 'all' ? expense + income : expense;

    const days = daysBetween(start, end);
    const avgDaily = days > 0 ? total / days : 0;
    const avgWeekly = avgDaily * 7;
    const avgMonthly = days > 0 ? total / (days / 30.44) : 0;

    // Median of individual amounts
    const amounts = filtered.map(t => t.amount || 0).sort((a, b) => a - b);
    const median = amounts.length > 0 ? quantile(amounts, 0.5) : 0;

    return Response.json({
      period: { start, end, days },
      type,
      total,
      avgDaily,
      avgWeekly,
      avgMonthly,
      median,
      count,
      truncated,
    });
  } catch (err) {
    console.error('getAverages error:', err);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
