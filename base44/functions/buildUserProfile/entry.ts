import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({}, { status: 401 });

    const { familyId } = await req.json();
    if (!familyId) return Response.json({});

    const todayISO = new Date().toISOString().slice(0, 10);

    // Check if profile already built today (dedup)
    const existing = await base44.entities.UserProfile.filter({ family_id: familyId });
    const profile = existing[0] || null;
    if (profile?.updated_at && profile.updated_at.slice(0, 10) === todayISO) {
      return Response.json(profile);
    }

    // Fetch last 30 days of expense transactions + categories
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffISO = cutoff.toISOString().slice(0, 10);

    const [transactions, categories] = await Promise.all([
      base44.entities.Transaction.filter({ family_id: familyId, type: 'expense' }, '-date', 1000),
      base44.entities.Category.filter({ family_id: familyId }),
    ]);

    const recent = transactions.filter(t => t.date >= cutoffISO);

    if (recent.length === 0) {
      return Response.json(profile || {});
    }

    // top_categories: group by category_id, sum amounts, top 5
    const catTotals: Record<string, number> = {};
    const methodCounts: Record<string, number> = {};
    const dayCounts: Record<number, number> = {};

    for (const t of recent) {
      if (t.category_id && t.amount) {
        catTotals[t.category_id] = (catTotals[t.category_id] || 0) + t.amount;
      }
      if (t.payment_method_id) {
        methodCounts[t.payment_method_id] = (methodCounts[t.payment_method_id] || 0) + 1;
      }
      if (t.date) {
        const dow = new Date(t.date + 'T12:00:00').getDay();
        dayCounts[dow] = (dayCounts[dow] || 0) + 1;
      }
    }

    const topCategories = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([catId, total]) => {
        const cat = categories.find(c => c.id === catId);
        return {
          category_id: catId,
          name: cat?.name ?? 'Sin categoría',
          icon: cat?.icon ?? '📁',
          total_amount: Math.round(total * 100) / 100,
        };
      });

    const totalSpend = recent.reduce((s, t) => s + (t.amount || 0), 0);
    const avg_weekly_spend = Math.round((totalSpend / 4.3) * 100) / 100;

    const top_payment_method_id = Object.entries(methodCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const mostActiveDowEntry = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])[0];
    const most_active_day = mostActiveDowEntry
      ? DAY_LABELS[parseInt(mostActiveDowEntry[0])]
      : null;

    const profileData = {
      family_id: familyId,
      top_categories: topCategories,
      avg_weekly_spend,
      top_payment_method_id,
      most_active_day,
      updated_at: new Date().toISOString(),
    };

    // Upsert
    let result;
    if (profile?.id) {
      result = await base44.entities.UserProfile.update(profile.id, profileData);
    } else {
      result = await base44.entities.UserProfile.create(profileData);
    }

    return Response.json(result || profileData);
  } catch {
    return Response.json({});
  }
});
