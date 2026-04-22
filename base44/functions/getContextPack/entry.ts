import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TIMEOUT_MS = 5000;

/** Wraps a promise with a 3-second AbortController-style timeout via Promise.race */
function withTimeout<T>(promise: Promise<T>, ms: number = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('fetch timeout')), ms)
    ),
  ]);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({}, { status: 401 });

    const { familyId } = await req.json();
    if (!familyId) return Response.json({});

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based
    const todayDay = now.getDate();

    // Fetch in parallel with timeout
    const [transactions, scheduledPayments, categories, anomalyAlerts, userProfiles] = await withTimeout(
      Promise.all([
        base44.entities.Transaction.filter({ family_id: familyId }, '-date', 500),
        base44.entities.ScheduledPayment.filter({ family_id: familyId, is_active: true }),
        base44.entities.Category.filter({ family_id: familyId }),
        base44.entities.AnomalyAlert.filter({ family_id: familyId, seen: false }),
        base44.entities.UserProfile.filter({ family_id: familyId }),
      ])
    );

    // Filter to current month
    const currentMonthTxs = transactions.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    // Compute totalExpense and totalIncome
    let totalExpense = 0;
    let totalIncome = 0;
    const catAmounts: Record<string, number> = {};

    currentMonthTxs.forEach(t => {
      const amt = t.amount || 0;
      if (t.type === 'expense') {
        totalExpense += amt;
        if (t.category_id) {
          catAmounts[t.category_id] = (catAmounts[t.category_id] || 0) + amt;
        }
      } else if (t.type === 'income') {
        totalIncome += amt;
      }
    });

    // Top 3 categories by total expense amount
    const topCategories = Object.entries(catAmounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([catId, amount]) => {
        const cat = categories.find(c => c.id === catId);
        return {
          name: cat?.name ?? 'Sin categoría',
          icon: cat?.icon ?? '📁',
          amount: Math.round(amount * 100) / 100,
        };
      });

    const monthSummary = {
      totalExpense: Math.round(totalExpense * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      topCategories,
    };

    // Upcoming payments due within the next 7 days (by due_day vs today)
    const upcomingPayments = scheduledPayments
      .filter(p => p.due_day >= todayDay && p.due_day <= todayDay + 6)
      .sort((a, b) => a.due_day - b.due_day)
      .map(p => ({
        name: p.name ?? '',
        due_day: p.due_day,
        amount: p.amount ?? 0,
        icon: p.icon ?? '📅',
      }));

    // Anomalies: most recent 3 unseen alerts
    const anomalies = anomalyAlerts
      .sort((a: { detected_at?: string }, b: { detected_at?: string }) =>
        (b.detected_at ?? '').localeCompare(a.detected_at ?? ''))
      .slice(0, 3)
      .map((a: { category_id?: string; message?: string; amount?: number; baseline?: number }) => ({
        category_id: a.category_id,
        message: a.message,
        amount: a.amount,
        baseline: a.baseline,
      }));

    // UserProfile: subset for context injection
    const rawProfile = userProfiles[0] ?? null;
    const userProfile = rawProfile ? {
      top_categories: rawProfile.top_categories ?? [],
      avg_weekly_spend: rawProfile.avg_weekly_spend ?? 0,
      most_active_day: rawProfile.most_active_day ?? null,
    } : null;

    return Response.json({ monthSummary, upcomingPayments, anomalies, userProfile });
  } catch {
    return Response.json({});
  }
});
