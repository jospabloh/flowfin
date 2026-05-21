import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { assertFamilyMember, errorResponse } from '../_txAggregateHelper.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { familyId, months = 3 } = body;
    if (!familyId) return Response.json({ error: 'Missing familyId' }, { status: 400 });

    try {
      await assertFamilyMember(base44, familyId);
    } catch (e) {
      return errorResponse(e);
    }

    // Use service role (RLS enforced by entities)
    const entities = base44.asServiceRole.entities;
    
    // Fetch last N months of transactions
    const allTx = await entities.Transaction.filter({ family_id: familyId }, '-date', 2000);
    const categories = await entities.Category.filter({ family_id: familyId });

    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1);

    const expenses = allTx.filter(t => {
      if (t.type !== 'expense') return false;
      if (!t.date) return false;
      return new Date(t.date) >= cutoff;
    });

    // Aggregate by category
    const catMap = {};
    expenses.forEach(t => {
      const key = t.category_id || '__none__';
      if (!catMap[key]) catMap[key] = { total: 0, count: 0, months: new Set() };
      catMap[key].total += t.amount || 0;
      catMap[key].count++;
      catMap[key].months.add(t.date.slice(0, 7));
    });

    // Build monthly averages
    const suggestions = Object.entries(catMap).map(([catId, data]) => {
      const cat = categories.find(c => c.id === catId);
      const activeMonths = Math.max(data.months.size, 1);
      const avgPerMonth = data.total / activeMonths;
      // Suggest 10% buffer above average
      const suggested = Math.round(avgPerMonth * 1.10);
      return {
        category_id: catId,
        category_name: cat?.name || 'Sin categoría',
        category_icon: cat?.icon || '📁',
        category_color: cat?.color || '#059669',
        avg_monthly: Math.round(avgPerMonth),
        suggested_budget: suggested,
        months_with_data: activeMonths,
        total_transactions: data.count,
      };
    }).sort((a, b) => b.avg_monthly - a.avg_monthly);

    // Total monthly income average
    const incomes = allTx.filter(t => {
      if (t.type !== 'income') return false;
      if (!t.date) return false;
      return new Date(t.date) >= cutoff;
    });
    const incomeMonths = new Set(incomes.map(t => t.date.slice(0, 7)));
    const totalIncome = incomes.reduce((s, t) => s + (t.amount || 0), 0);
    const avgMonthlyIncome = incomeMonths.size > 0 ? Math.round(totalIncome / incomeMonths.size) : 0;

    const totalSuggestedBudget = suggestions.reduce((s, c) => s + c.suggested_budget, 0);

    return Response.json({
      suggestions,
      avg_monthly_income: avgMonthlyIncome,
      total_suggested_budget: totalSuggestedBudget,
      months_analyzed: months,
      expense_count: expenses.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});