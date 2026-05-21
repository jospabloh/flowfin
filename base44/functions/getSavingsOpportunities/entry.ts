import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { assertFamilyMember, errorResponse } from '../_txAggregateHelper.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const familyId = body.familyId;
    if (!familyId) return Response.json({ error: 'familyId required' }, { status: 400 });

    try {
      await assertFamilyMember(base44, familyId);
    } catch (e) {
      return errorResponse(e);
    }

    // Fetch last 6 months of expense transactions
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const fromDate = sixMonthsAgo.toISOString().slice(0, 10);

    const allTransactions = await base44.asServiceRole.entities.Transaction.filter({
      family_id: familyId,
      type: 'expense',
    });

    const transactions = allTransactions.filter(t => t.date >= fromDate);

    if (transactions.length === 0) {
      return Response.json({
        summary: { totalMonthlySavings: 0, totalAnnualSavings: 0 },
        forgottenSubscriptions: [],
        nonEssentialOpportunities: [],
      });
    }

    // --- 1. Forgotten Subscriptions ---
    // Group transactions by normalized description
    const descriptionMap = {};
    for (const t of transactions) {
      const key = (t.description || '').trim().toLowerCase();
      if (!key) continue;
      if (!descriptionMap[key]) descriptionMap[key] = [];
      descriptionMap[key].push(t);
    }

    const forgottenSubscriptions = [];
    for (const [desc, txs] of Object.entries(descriptionMap)) {
      if (txs.length < 2) continue;
      // Check if they appear in different months
      const months = new Set(txs.map(t => t.date?.slice(0, 7)));
      if (months.size < 2) continue;

      const amounts = txs.map(t => t.amount || 0);
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stdDev = Math.sqrt(amounts.map(a => Math.pow(a - avgAmount, 2)).reduce((a, b) => a + b, 0) / amounts.length);
      const isConsistent = stdDev / (avgAmount || 1) < 0.2; // coefficient of variation < 20%

      if (isConsistent && avgAmount > 0) {
        const confidence = months.size >= 4 ? 'alta' : months.size >= 3 ? 'media' : 'baja';
        forgottenSubscriptions.push({
          description: txs[0].description || desc,
          occurrences: months.size,
          avgAmount: Math.round(avgAmount * 100) / 100,
          confidence,
        });
      }
    }

    // Sort by avgAmount desc
    forgottenSubscriptions.sort((a, b) => b.avgAmount - a.avgAmount);

    // --- 2. Non-essential Opportunities ---
    // Group by category and required_type
    const nonEssentialTypes = ['Gusto', 'Otro'];
    const nonEssentialTxs = transactions.filter(t => nonEssentialTypes.includes(t.required_type));

    // Also include transactions in categories by spending amount
    const categoryTotals = {};
    const totalExpense = transactions.reduce((s, t) => s + (t.amount || 0), 0);

    for (const t of nonEssentialTxs) {
      const catId = t.category_id || 'sin_categoria';
      if (!categoryTotals[catId]) {
        categoryTotals[catId] = { categoryId: catId, categoryName: null, total: 0, count: 0, months: new Set() };
      }
      categoryTotals[catId].total += t.amount || 0;
      categoryTotals[catId].count += 1;
      categoryTotals[catId].months.add(t.date?.slice(0, 7));
    }

    // Fetch categories to get names
    const categories = await base44.asServiceRole.entities.Category.filter({ family_id: familyId });
    const catMap = {};
    for (const c of categories) catMap[c.id] = c;

    const nonEssentialOpportunities = [];
    const monthsInRange = 6;

    for (const [catId, data] of Object.entries(categoryTotals)) {
      if (data.total === 0) continue;
      const cat = catMap[catId];
      const avgMonthly = data.total / monthsInRange;
      const percentageOfExpenses = totalExpense > 0 ? (data.total / totalExpense) * 100 : 0;
      const potentialSavings = avgMonthly * 0.3; // suggest 30% reduction

      nonEssentialOpportunities.push({
        categoryId: catId,
        categoryName: cat ? `${cat.icon || ''} ${cat.name}`.trim() : 'Sin categoría',
        avgMonthly: Math.round(avgMonthly * 100) / 100,
        totalSpent: Math.round(data.total * 100) / 100,
        percentageOfExpenses: Math.round(percentageOfExpenses * 10) / 10,
        potentialSavings: Math.round(potentialSavings * 100) / 100,
      });
    }

    nonEssentialOpportunities.sort((a, b) => b.avgMonthly - a.avgMonthly);

    // --- Summary ---
    const subSavings = forgottenSubscriptions.reduce((s, x) => s + x.avgAmount, 0);
    const oppSavings = nonEssentialOpportunities.reduce((s, x) => s + x.potentialSavings, 0);
    const totalMonthlySavings = Math.round((subSavings + oppSavings) * 100) / 100;
    const totalAnnualSavings = Math.round(totalMonthlySavings * 12 * 100) / 100;

    return Response.json({
      summary: { totalMonthlySavings, totalAnnualSavings },
      forgottenSubscriptions: forgottenSubscriptions.slice(0, 10),
      nonEssentialOpportunities: nonEssentialOpportunities.slice(0, 10),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});