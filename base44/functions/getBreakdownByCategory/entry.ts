import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  assertFamilyMember,
  fetchAllTransactions,
  groupSum,
} from '../_txAggregateHelper.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const {
      familyId,
      start,
      end,
      type = 'expense',
      personId,
      topN,
    } = body;

    if (!familyId) {
      return Response.json({ error: 'familyId required' }, { status: 400 });
    }

    // Auth: caller must be an approved family member before any data query.
    await assertFamilyMember(base44, familyId);

    const { transactions, truncated } = await fetchAllTransactions(base44, {
      familyId,
      start,
      end,
      type,
      personId,
    });

    const rawGroups = groupSum(
      transactions,
      (tx) => tx.category_id ?? null,
      type === 'all' ? 'expense' : (type as 'expense' | 'income'),
    );

    // Single batch read for category names — never one query per group.
    const categories: Array<{ id: string; name?: string }> =
      await base44.asServiceRole.entities.Category.filter({ family_id: familyId });

    const catMap = new Map(categories.map((c) => [c.id, c.name ?? c.id]));

    const grandTotal = rawGroups.reduce((s, g) => s + g.total, 0);

    let groups = rawGroups.map((g) => ({
      category_id: g.key,
      name: catMap.get(g.key) ?? g.key,
      total: g.total,
      count: g.count,
      pct: grandTotal > 0 ? Math.round((g.total / grandTotal) * 10000) / 100 : 0,
    }));

    if (topN && typeof topN === 'number' && topN > 0) {
      groups = groups.slice(0, topN);
    }

    return Response.json({
      period: { start: start ?? null, end: end ?? null },
      type,
      groups,
      grand_total: grandTotal,
      truncated,
    });
  } catch (error) {
    const status = (error as Record<string, number>).httpStatus;
    if (status === 403) return Response.json({ error: 'forbidden' }, { status: 403 });
    if (status === 401) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    console.error('getBreakdownByCategory error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
