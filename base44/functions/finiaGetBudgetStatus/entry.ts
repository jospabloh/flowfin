import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Returns budget status for the current month.
// Identifies categories near or over budget limit.
// Resolves family_id server-side from authenticated session.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const srEntities = base44.asServiceRole.entities;
    const userEntities = base44.entities;

    let memberships = await srEntities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) memberships = await srEntities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    if (!memberships.length) return Response.json({ error: 'forbidden' }, { status: 403 });

    const activeId = user.data?.family_id ?? user.data?.data?.family_id;
    const membership = memberships.find(m => m.family_id === activeId)
      ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
    const familyId = membership.family_id;

    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const currentMonth = todayISO.slice(0, 7);

    // Use user-scoped entities — asServiceRole returns empty for family-scoped entities
    const [budgets, categories, txs] = await Promise.all([
      userEntities.CategoryBudget.filter({ family_id: familyId }).catch(() => []),
      userEntities.Category.filter({ family_id: familyId }).catch(() => []),
      userEntities.Transaction.filter({ family_id: familyId }, '-date', 500).catch(() => []),
    ]);

    const catMap = new Map((categories || []).map(c => [c.id, c]));
    const activeBudgets = (budgets || []).filter(b => !b.period || b.period === currentMonth);

    // Aggregate current month expenses by category
    const monthTxs = (txs || []).filter(tx => tx.date >= monthStart && tx.date <= todayISO && tx.type === 'expense');
    const catSpend = new Map();
    for (const tx of monthTxs) {
      if (!tx.category_id) continue;
      catSpend.set(tx.category_id, (catSpend.get(tx.category_id) ?? 0) + (tx.amount || 0));
    }

    const statusItems = [];
    for (const budget of activeBudgets) {
      const cat = catMap.get(budget.category_id);
      if (!cat) continue;
      const spent = catSpend.get(budget.category_id) ?? 0;
      const pct = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
      const remaining = budget.amount - spent;
      let alert = null;
      if (pct >= 100) alert = '🔴 Sobre el presupuesto';
      else if (pct >= 80) alert = '🟡 Cerca del límite';

      statusItems.push({
        category_name: cat.name,
        budget: budget.amount,
        spent,
        remaining,
        pct_used: pct,
        alert,
      });
    }

    statusItems.sort((a, b) => b.pct_used - a.pct_used);

    const overBudget = statusItems.filter(i => i.pct_used >= 100);
    const nearBudget = statusItems.filter(i => i.pct_used >= 80 && i.pct_used < 100);

    return Response.json({
      period: { start: monthStart, end: todayISO },
      budgets: statusItems,
      over_budget_count: overBudget.length,
      near_budget_count: nearBudget.length,
      summary: overBudget.length > 0
        ? `⚠️ Tienes ${overBudget.length} categoría(s) sobre el presupuesto este mes.`
        : nearBudget.length > 0
          ? `ℹ️ Tienes ${nearBudget.length} categoría(s) cerca del límite mensual.`
          : '✅ Todos los presupuestos están dentro del límite.',
    });
  } catch (error) {
    console.error('finiaGetBudgetStatus error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});