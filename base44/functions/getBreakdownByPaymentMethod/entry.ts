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

    const rawGroups = groupSum(
      transactions,
      (tx) => tx.payment_method_id ?? null,
      type === 'all' ? 'expense' : (type as 'expense' | 'income'),
    );

    // Single batch read for payment method names — never one query per group.
    const paymentMethods: Array<{ id: string; name?: string }> =
      await base44.asServiceRole.entities.PaymentMethod.filter({ family_id: familyId });

    const pmMap = new Map(paymentMethods.map((pm) => [pm.id, pm.name ?? pm.id]));

    const groups = rawGroups.map((g) => ({
      payment_method_id: g.key,
      name: pmMap.get(g.key) ?? g.key,
      total: g.total,
      count: g.count,
    }));

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

    console.error('getBreakdownByPaymentMethod error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
