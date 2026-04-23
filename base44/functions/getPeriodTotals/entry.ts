import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  assertFamilyMember,
  fetchAllTransactions,
  sumByType,
  daysBetween,
} from '../_txAggregateHelper.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const {
      familyId,
      start,
      end,
      personId,
      categoryId,
      paymentMethodId,
      type = 'all',
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
      categoryId,
      paymentMethodId,
    });

    const total = sumByType(transactions);

    const appliedFilters: Record<string, unknown> = { type };
    if (start) appliedFilters.start = start;
    if (end) appliedFilters.end = end;
    if (personId) appliedFilters.personId = personId;
    if (categoryId) appliedFilters.categoryId = categoryId;
    if (paymentMethodId) appliedFilters.paymentMethodId = paymentMethodId;

    return Response.json({
      period: {
        start: start ?? null,
        end: end ?? null,
        days: start && end ? daysBetween(start, end) : null,
      },
      total,
      truncated,
      filters: appliedFilters,
    });
  } catch (error) {
    const status =
      (error as Record<string, number>).httpStatus === 403 ? 403 :
      (error as Record<string, number>).httpStatus === 401 ? 401 : null;

    if (status === 403) return Response.json({ error: 'forbidden' }, { status: 403 });
    if (status === 401) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    console.error('getPeriodTotals error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
