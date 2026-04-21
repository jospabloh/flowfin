import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({}, { status: 401 });

    const { familyId } = await req.json();
    if (!familyId) return Response.json({});

    const now = new Date();
    const currentWeekKey = getISOWeekKey(now);

    // Fetch last ~13 weeks of expense transactions (91 days)
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 91);
    const cutoffISO = cutoff.toISOString().slice(0, 10);

    const [transactions, categories] = await Promise.all([
      base44.entities.Transaction.filter({ family_id: familyId, type: 'expense' }, '-date', 2000),
      base44.entities.Category.filter({ family_id: familyId }),
    ]);

    // Filter to last 91 days
    const recent = transactions.filter(t => t.date >= cutoffISO);

    // Group by (category_id, weekKey) → total amount
    const weekAmounts: Record<string, Record<string, number>> = {};
    for (const t of recent) {
      if (!t.category_id || !t.date || !t.amount) continue;
      const wk = getISOWeekKey(new Date(t.date + 'T12:00:00'));
      if (!weekAmounts[t.category_id]) weekAmounts[t.category_id] = {};
      weekAmounts[t.category_id][wk] = (weekAmounts[t.category_id][wk] || 0) + t.amount;
    }

    let alertsCreated = 0;

    for (const [categoryId, weekMap] of Object.entries(weekAmounts)) {
      const currentAmount = weekMap[currentWeekKey] || 0;
      if (currentAmount === 0) continue;

      // Baseline = all weeks except current
      const baselineAmounts = Object.entries(weekMap)
        .filter(([wk]) => wk !== currentWeekKey)
        .map(([, amt]) => amt);

      if (baselineAmounts.length < 5) continue; // need enough data

      const mean = baselineAmounts.reduce((s, v) => s + v, 0) / baselineAmounts.length;
      const variance = baselineAmounts.reduce((s, v) => s + (v - mean) ** 2, 0) / baselineAmounts.length;
      const stddev = Math.sqrt(variance);

      // When stddev is 0 all baseline weeks are identical — any increase is a spike;
      // use a 20% threshold above mean to avoid alerting on negligible rounding noise.
      const threshold = stddev === 0 ? mean * 1.2 : mean + 2 * stddev;
      if (currentAmount <= threshold) continue;

      // Check dedup: already alerted this week for this category?
      // Re-query inside a try/catch so a race-condition duplicate write is swallowed.
      let existing: unknown[] = [];
      try {
        existing = await base44.entities.AnomalyAlert.filter({
          family_id: familyId,
          category_id: categoryId,
          week_key: currentWeekKey,
        });
      } catch { existing = []; }
      if (existing.length > 0) continue;

      // Create alert; if a concurrent request already inserted one, swallow the error.
      try {
        const cat = categories.find(c => c.id === categoryId);
        const catName = cat ? `${cat.icon ?? ''} ${cat.name}`.trim() : 'una categoría';
        const ratio = mean > 0 ? (currentAmount / mean).toFixed(1) : '∞';
        const message = `Gastos en ${catName} esta semana: $${Math.round(currentAmount).toLocaleString('es-MX')} (${ratio}× lo habitual de $${Math.round(mean).toLocaleString('es-MX')}).`;

        await base44.entities.AnomalyAlert.create({
          family_id: familyId,
          category_id: categoryId,
          kind: 'spending_spike',
          amount: Math.round(currentAmount * 100) / 100,
          baseline: Math.round(mean * 100) / 100,
          message,
          seen: false,
          week_key: currentWeekKey,
          detected_at: now.toISOString(),
        });
        alertsCreated++;
      } catch { /* duplicate insert from concurrent call — safe to ignore */ }
    }

    return Response.json({ alertsCreated });
  } catch {
    return Response.json({});
  }
});
