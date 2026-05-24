import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { resolveAccess, resolvePersonFilter, errorResponse } from '../_txAggregateHelper.ts';

async function fetchAllTransactions(entities, { familyId, start, end, type, personId, categoryId, paymentMethodId }) {
  const PAGE = 200;
  let all = [];
  let skip = 0;
  let truncated = false;
  const filter = { family_id: familyId };
  if (start) filter.date = { ...filter.date, $gte: start };
  if (end) filter.date = { ...filter.date, $lte: end };
  if (type && type !== 'all') filter.type = type;
  if (personId) filter.person_id = personId;
  if (categoryId) filter.category_id = categoryId;
  if (paymentMethodId) filter.payment_method_id = paymentMethodId;

  // [DEBUG-TX] temporary diagnostic — remove after root cause found
  console.log('[DEBUG-TX] fetchAllTransactions called — familyId:', familyId, 'personId:', personId ?? null);
  console.log('[DEBUG-TX] filter passed to Transaction.filter:', JSON.stringify(filter));

  // [DEBUG-TX] control query 1: no date, no type filter
  try {
    const ctrl1 = await entities.Transaction.filter({ family_id: familyId });
    console.log('[DEBUG-TX] control1 (family only, no date/type) count:', (ctrl1 || []).length);
  } catch (e) {
    console.log('[DEBUG-TX] control1 error:', e?.message ?? String(e));
  }

  // [DEBUG-TX] control query 2: family_id + type=expense, no date filter
  try {
    const ctrl2 = await entities.Transaction.filter({ family_id: familyId, type: 'expense' });
    console.log('[DEBUG-TX] control2 (family + type=expense, no date) count:', (ctrl2 || []).length);
  } catch (e) {
    console.log('[DEBUG-TX] control2 error:', e?.message ?? String(e));
  }

  // [DEBUG-TX] control query 3: alternate suffix syntax for date range
  if (start || end) {
    try {
      const ctrl3Filter: Record<string, unknown> = { family_id: familyId };
      if (start) ctrl3Filter.date_gte = start;
      if (end) ctrl3Filter.date_lte = end;
      const ctrl3 = await entities.Transaction.filter(ctrl3Filter);
      console.log('[DEBUG-TX] control3 (suffix date_gte/date_lte) filter:', JSON.stringify(ctrl3Filter), 'count:', (ctrl3 || []).length);
    } catch (e) {
      console.log('[DEBUG-TX] control3 error:', e?.message ?? String(e));
    }
  }

  while (true) {
    const page = await entities.Transaction.filter(filter, '-date', PAGE, skip);
    all = all.concat(page || []);
    if (!page || page.length < PAGE) break;
    skip += PAGE;
    if (all.length >= 2000) { truncated = true; break; }
  }

  // [DEBUG-TX] log real query result count
  console.log('[DEBUG-TX] real query total transactions returned:', all.length, 'truncated:', truncated);

  return { transactions: all, truncated };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { start, end, type = 'all', categoryId, paymentMethodId } = body;

    let access;
    try {
      access = await resolveAccess(base44, body.familyId);
    } catch (err) {
      return errorResponse(err);
    }
    const familyId = access.familyId;
    const personId = resolvePersonFilter(access, { personId: body.personId, scope: body.scope });

    const entities = base44.asServiceRole.entities;
    const [{ transactions, truncated }, categoriesArr] = await Promise.all([
      fetchAllTransactions(entities, { familyId, start, end, type, personId, categoryId, paymentMethodId }),
      entities.Category.filter({ family_id: familyId }),
    ]);

    const excludedCatIds = new Set(
      (categoriesArr || []).filter((c) => c.exclude_from_totals).map((c) => c.id),
    );

    let expense = 0, income = 0;
    for (const tx of transactions) {
      if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
      if (tx.category_id && excludedCatIds.has(tx.category_id)) continue;
      if (tx.type === 'expense') expense += tx.amount;
      else if (tx.type === 'income') income += tx.amount;
    }
    const balance = income - expense;

    // [DEBUG-TX] temporary diagnostic — remove after root cause found
    console.log('[DEBUG-TX] getPeriodTotals resolved familyId:', familyId, 'personId:', personId ?? null);
    console.log('[DEBUG-TX] getPeriodTotals final totals — expense:', expense, 'income:', income, 'balance:', balance, 'txCount:', transactions.length);

    return Response.json({
      period: { start: start ?? null, end: end ?? null },
      total: { expense, income, balance },
      truncated,
    });
  } catch (error) {
    console.error('getPeriodTotals error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
});