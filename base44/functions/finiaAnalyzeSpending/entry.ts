import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Analyzes spending behavior across 1-3 months.
// Resolves family_id server-side from authenticated session.
// IMPORTANT: Use base44.entities (user-context) for all family-scoped reads.
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

    const body = await req.json().catch(() => ({}));
    const months = Math.min(Math.max(parseInt(body.months ?? '2', 10), 1), 3);

    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (months - 1), 1)).toISOString().slice(0, 10);

    console.log('[finiaAnalyzeSpending] familyId:', familyId, 'start:', startDate);

    // All reads through user-context
    const [allTxs, categories] = await Promise.all([
      userEntities.Transaction.filter({ family_id: familyId }, '-date', 500).catch(() => []),
      userEntities.Category.filter({ family_id: familyId }).catch(() => []),
    ]);

    console.log('[finiaAnalyzeSpending] allTxs:', allTxs.length, 'categories:', categories.length);

    const catMap = new Map((categories || []).map(c => [c.id, c.name ?? c.id]));
    const excludedCatIds = new Set((categories || []).filter(c => c.exclude_from_totals).map(c => c.id));

    const txs = (allTxs || []).filter(tx =>
      tx.date >= startDate && tx.date <= todayISO &&
      tx.type === 'expense' &&
      !excludedCatIds.has(tx.category_id)
    );

    // Top categories by total
    const catAgg = new Map();
    for (const tx of txs) {
      if (!tx.category_id) continue;
      const e = catAgg.get(tx.category_id) ?? { total: 0, count: 0, amounts: [] };
      e.total += tx.amount || 0;
      e.count++;
      e.amounts.push(tx.amount || 0);
      catAgg.set(tx.category_id, e);
    }

    const topCategories = Array.from(catAgg.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8)
      .map(([catId, agg]) => ({
        name: catMap.get(catId) ?? 'Sin categoría',
        total: agg.total,
        count: agg.count,
        avg_per_transaction: agg.count > 0 ? Math.round(agg.total / agg.count) : 0,
      }));

    // Month-over-month comparison
    const currMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const prevMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
    const prevMonthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)).toISOString().slice(0, 10);

    const currTxs = txs.filter(tx => tx.date >= currMonthStart);
    const prevTxs = txs.filter(tx => tx.date >= prevMonthStart && tx.date <= prevMonthEnd);

    const currTotal = currTxs.reduce((s, tx) => s + (tx.amount || 0), 0);
    const prevTotal = prevTxs.reduce((s, tx) => s + (tx.amount || 0), 0);
    const delta = currTotal - prevTotal;
    const deltaPct = prevTotal > 0 ? Math.round((delta / prevTotal) * 100) : null;

    // Unusual transactions
    const unusual = [];
    for (const [catId, agg] of catAgg.entries()) {
      if (agg.count < 2) continue;
      const avg = agg.total / agg.count;
      const stdDev = Math.sqrt(agg.amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / agg.amounts.length);
      for (const tx of txs.filter(tx => tx.category_id === catId)) {
        if (tx.amount > avg + 2 * stdDev && tx.amount > avg * 1.5) {
          unusual.push({
            date: tx.date,
            amount: tx.amount,
            category_name: catMap.get(catId) ?? 'Sin categoría',
            description: tx.description ? String(tx.description).slice(0, 60) : null,
            note: `Este gasto es significativamente mayor al promedio de ${catMap.get(catId) ?? 'esta categoría'} ($${Math.round(avg)}).`,
          });
        }
      }
    }

    const suggestions = [];
    if (topCategories.length > 0) {
      suggestions.push(`Tu mayor gasto es en "${topCategories[0].name}" con $${Math.round(topCategories[0].total)} en el período.`);
    }
    if (deltaPct !== null && deltaPct > 20) {
      suggestions.push(`Tus gastos este mes son ${deltaPct}% mayores que el mes anterior. Revisa en qué categorías aumentó el gasto.`);
    } else if (deltaPct !== null && deltaPct < -10) {
      suggestions.push(`Buen trabajo: tus gastos este mes son ${Math.abs(deltaPct)}% menores que el mes anterior.`);
    }
    if (unusual.length > 0) {
      suggestions.push(`Detecté ${unusual.length} transacción(es) inusualmente alta(s). Revísalas para confirmar que sean correctas.`);
    }

    return Response.json({
      period: { start: startDate, end: todayISO, months_analyzed: months },
      totals: { current_month: currTotal, previous_month: prevTotal, delta, delta_pct: deltaPct },
      top_categories: topCategories,
      unusual_transactions: unusual.slice(0, 5),
      suggestions,
    });
  } catch (error) {
    console.error('finiaAnalyzeSpending error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});