import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  assertFamilyMember,
  fetchAllTransactions,
  normalizeMerchant,
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
      topN = 10,
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
    });

    // Aggregate by normalized merchant slug for the requested type only.
    const merchantMap = new Map<string, { total: number; count: number }>();

    for (const tx of transactions) {
      if (tx.type !== type) continue;
      if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
      const merchant = normalizeMerchant(tx.description ?? '');
      const entry = merchantMap.get(merchant) ?? { total: 0, count: 0 };
      entry.total += tx.amount;
      entry.count++;
      merchantMap.set(merchant, entry);
    }

    const groups = Array.from(merchantMap.entries())
      .map(([merchant, v]) => ({ merchant, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, typeof topN === 'number' && topN > 0 ? topN : 10);

    return Response.json({
      period: { start: start ?? null, end: end ?? null },
      type,
      groups,
      truncated,
    });
  } catch (error) {
    const status = (error as Record<string, number>).httpStatus;
    if (status === 403) return Response.json({ error: 'forbidden' }, { status: 403 });
    if (status === 401) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    console.error('getBreakdownByMerchant error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
