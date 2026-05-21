import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  resolveAccess,
  resolvePersonFilter,
  errorResponse,
  fetchAllTransactions,
  quantile,
} from '../_txAggregateHelper.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { categoryId, start, end, type = 'expense' } = body;

    let access;
    try {
      access = await resolveAccess(base44, body.familyId);
    } catch (err) {
      return errorResponse(err);
    }
    const familyId = access.familyId;
    const personId = resolvePersonFilter(access, { personId: body.personId, scope: body.scope });

    if (!start || !end || new Date(start) > new Date(end)) {
      return Response.json({ error: 'invalid date range' }, { status: 400 });
    }

    const { transactions, truncated } = await fetchAllTransactions(base44, {
      familyId, start, end, categoryId, type, personId,
    });

    const filtered = type === 'all' ? transactions : transactions.filter(t => t.type === type);
    const amounts = filtered.map(t => t.amount || 0).sort((a, b) => a - b);
    const count = amounts.length;

    // Fetch category name
    const categories = await base44.asServiceRole.entities.Category.filter({ family_id: familyId });
    const cat = categories.find((c: { id: string; name: string }) => c.id === categoryId);
    const categoryInfo = { id: categoryId, name: cat?.name ?? null };

    if (count === 0) {
      return Response.json({
        period: { start, end },
        type,
        category: categoryInfo,
        stats: { mean: 0, stddev: 0, min: 0, max: 0, p50: 0, p90: 0, count: 0 },
        empty: true,
        truncated,
      });
    }

    const sum = amounts.reduce((s, a) => s + a, 0);
    const mean = sum / count;
    const variance = amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / count;
    const stddev = Math.sqrt(variance);
    const min = amounts.reduce((m, a) => Math.min(m, a), amounts[0]);
    const max = amounts.reduce((m, a) => Math.max(m, a), amounts[0]);
    const p50 = quantile(amounts, 0.5);
    const p90 = quantile(amounts, 0.9);

    return Response.json({
      period: { start, end },
      type,
      category: categoryInfo,
      stats: { mean, stddev, min, max, p50, p90, count },
      empty: false,
      truncated,
    });
  } catch (err) {
    console.error('getCategoryStats error:', err);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
