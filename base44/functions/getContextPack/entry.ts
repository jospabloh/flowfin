import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TIMEOUT_MS = 10000;

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
    const [transactions, scheduledPayments, categories, anomalyAlerts, userProfiles, persons, memberships] =
      await withTimeout(
        Promise.all([
          base44.entities.Transaction.filter({ family_id: familyId }, '-date', 500),
          base44.entities.ScheduledPayment.filter({ family_id: familyId, is_active: true }),
          base44.entities.Category.filter({ family_id: familyId }),
          base44.entities.AnomalyAlert.filter({ family_id: familyId, seen: false }),
          base44.entities.UserProfile.filter({ family_id: familyId }),
          base44.entities.Person.filter({ family_id: familyId }),
          base44.entities.FamilyMembership.filter({ family_id: familyId, status: 'approved' }),
        ])
      );

    // Filter to current month
    const currentMonthTxs = transactions.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    // Compute family totals and per-person breakdown
    let totalExpense = 0;
    let totalIncome = 0;
    const catAmounts: Record<string, number> = {};
    const personExpense: Record<string, number> = {};
    const personIncome: Record<string, number> = {};

    currentMonthTxs.forEach(t => {
      const amt = t.amount || 0;
      const pid = t.person_id || '';
      if (t.type === 'expense') {
        totalExpense += amt;
        if (t.category_id) catAmounts[t.category_id] = (catAmounts[t.category_id] || 0) + amt;
        if (pid) personExpense[pid] = (personExpense[pid] || 0) + amt;
      } else if (t.type === 'income') {
        totalIncome += amt;
        if (pid) personIncome[pid] = (personIncome[pid] || 0) + amt;
      }
    });

    // Top 3 categories
    const topCategories = Object.entries(catAmounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([catId, amount]) => {
        const cat = categories.find((c: { id: string; name?: string; icon?: string }) => c.id === catId);
        return {
          name: cat?.name ?? 'Sin categoría',
          icon: cat?.icon ?? '📁',
          amount: Math.round(amount * 100) / 100,
        };
      });

    // Per-person spending breakdown — include ALL persons so AI knows the full roster
    const byPerson = persons.map((p: { id: string; name?: string; icon?: string }) => ({
      id: p.id,
      name: p.name ?? 'Sin nombre',
      icon: p.icon ?? '👤',
      expense: Math.round((personExpense[p.id] || 0) * 100) / 100,
      income: Math.round((personIncome[p.id] || 0) * 100) / 100,
    }));

    const monthSummary = {
      totalExpense: Math.round(totalExpense * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      topCategories,
      byPerson,
    };

    // Resolve current user's Person identity via membership.person_id
    // Match by user.id first, fallback to user.email
    const myMembership = memberships.find(
      (m: { user_id?: string; user_email?: string; person_id?: string; role?: string; user_name?: string }) =>
        m.user_id === user.id || m.user_email === user.email
    );
    let currentUserCtx: Record<string, string | null> = {
      memberName: myMembership?.user_name ?? null,
      role: myMembership?.role ?? null,
      personId: null,
      personName: null,
      membershipId: myMembership?.id ?? null,
    };
    if (myMembership?.person_id) {
      const linkedPerson = persons.find((p: { id: string; name?: string }) => p.id === myMembership.person_id);
      if (linkedPerson) {
        currentUserCtx.personId = linkedPerson.id;
        currentUserCtx.personName = linkedPerson.name ?? null;
      }
    }

    // Upcoming payments due within the next 7 days
    const upcomingPayments = scheduledPayments
      .filter((p: { due_day?: number }) => p.due_day != null && p.due_day >= todayDay && p.due_day <= todayDay + 6)
      .sort((a: { due_day: number }, b: { due_day: number }) => a.due_day - b.due_day)
      .map((p: { name?: string; due_day?: number; amount?: number; icon?: string }) => ({
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

    // UserProfile subset
    const rawProfile = userProfiles[0] ?? null;
    const userProfile = rawProfile ? {
      top_categories: rawProfile.top_categories ?? [],
      avg_weekly_spend: rawProfile.avg_weekly_spend ?? 0,
      most_active_day: rawProfile.most_active_day ?? null,
    } : null;

    // Full persons list (id + name) so the agent knows who is in the family
    const personsList = persons.map((p: { id: string; name?: string; icon?: string }) => ({
      id: p.id,
      name: p.name ?? 'Sin nombre',
      icon: p.icon ?? '👤',
    }));

    return Response.json({
      monthSummary,
      currentUser: currentUserCtx,
      persons: personsList,
      upcomingPayments,
      anomalies,
      userProfile,
    });
  } catch {
    return Response.json({});
  }
});
