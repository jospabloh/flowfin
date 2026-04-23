import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  assertFamilyMember,
  fetchAllTransactions,
  sumByType,
} from '../_txAggregateHelper.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { familyId, currentStart, currentEnd, previousStart, previousEnd, type = 'expense', personId } = body;

    if (!familyId) return Response.json({ error: 'familyId required' }, { status: 400 });

    if (
      !currentStart || !currentEnd || new Date(currentStart) > new Date(currentEnd) ||
      !previousStart || !previousEnd || new Date(previousStart) > new Date(previousEnd)
    ) {
      return Response.json({ error: 'invalid date range' }, { status: 400 });
    }

    // Auth check before any data query
    try {
      await assertFamilyMember(base44, familyId);
    } catch {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    // Fetch both periods in parallel
    const [currentFetch, previousFetch] = await Promise.all([
      fetchAllTransactions(base44, { familyId, start: currentStart, end: currentEnd, type, personId }),
      fetchAllTransactions(base44, { familyId, start: previousStart, end: previousEnd, type, personId }),
    ]);

    const currentSums = sumByType(currentFetch.transactions);
    const previousSums = sumByType(previousFetch.transactions);

    // Select the right amount for comparison
    const pickAmount = (sums: ReturnType<typeof sumByType>) => {
      if (type === 'income') return sums.income;
      if (type === 'all') return sums.balance;
      return sums.expense;
    };

    const currentAmount = pickAmount(currentSums);
    const previousAmount = pickAmount(previousSums);

    const absChange = currentAmount - previousAmount;
    const pctChange = previousAmount === 0 ? null : (absChange / Math.abs(previousAmount)) * 100;
    const direction = absChange > 0 ? 'up' : absChange < 0 ? 'down' : 'flat';

    return Response.json({
      type,
      current: {
        period: { start: currentStart, end: currentEnd },
        total: currentAmount,
        count: currentSums.count,
      },
      previous: {
        period: { start: previousStart, end: previousEnd },
        total: previousAmount,
        count: previousSums.count,
      },
      delta: { abs: absChange, pct: pctChange, direction },
      truncated: currentFetch.truncated || previousFetch.truncated,
    });
  } catch (err) {
    console.error('getPeriodComparison error:', err);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
