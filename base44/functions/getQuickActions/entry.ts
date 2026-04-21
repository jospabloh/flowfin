import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FALLBACK_ACTIONS = [
  '💸 Registra tu próximo gasto',
  '📋 Revisa tus compromisos del mes',
  '💰 Registra un ingreso',
  '📊 ¿Cómo voy este mes?',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ actions: FALLBACK_ACTIONS }, { status: 401 });

    const { familyId } = await req.json();
    if (!familyId) return Response.json({ actions: FALLBACK_ACTIONS });

    // Fetch in parallel
    const [transactions, scheduledPayments, categories] = await Promise.all([
      base44.entities.Transaction.filter({ family_id: familyId }, '-date', 100),
      base44.entities.ScheduledPayment.filter({ family_id: familyId, is_active: true }),
      base44.entities.Category.filter({ family_id: familyId }),
    ]);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based
    const todayDay = now.getDate();

    // 1. Top category of the current month (expenses only)
    const monthExpenses = transactions.filter(t => {
      if (t.type !== 'expense' || !t.date) return false;
      const d = new Date(t.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const catTotals: Record<string, number> = {};
    monthExpenses.forEach(t => {
      if (t.category_id) {
        catTotals[t.category_id] = (catTotals[t.category_id] || 0) + (t.amount || 0);
      }
    });
    const topCatId = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a])[0] ?? null;
    const topCategory = topCatId ? categories.find(c => c.id === topCatId) ?? null : null;

    // 2. Next scheduled payment due within 7 days
    // due_day is day-of-month; find earliest due_day >= todayDay within this month,
    // or the earliest due_day in next month if nothing remains this month
    let upcomingPayment: typeof scheduledPayments[number] | null = null;

    const thisMonthDue = scheduledPayments
      .filter(p => p.due_day >= todayDay && p.due_day <= todayDay + 6)
      .sort((a, b) => a.due_day - b.due_day);

    if (thisMonthDue.length > 0) {
      upcomingPayment = thisMonthDue[0];
    }

    // 3. Most frequent income description from last 100 transactions
    const incomeDescFreq: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.type === 'income' && t.description) {
        const key = t.description.trim();
        incomeDescFreq[key] = (incomeDescFreq[key] || 0) + 1;
      }
    });
    const topIncomeDesc = Object.keys(incomeDescFreq)
      .sort((a, b) => incomeDescFreq[b] - incomeDescFreq[a])[0] ?? null;

    // Build 4 action strings in Spanish
    const actions: string[] = [];

    // Action 1: top expense category
    if (topCategory) {
      actions.push(`Registra gasto en ${topCategory.icon ?? '💸'} ${topCategory.name}`);
    } else {
      actions.push('💸 Registra tu próximo gasto');
    }

    // Action 2: upcoming scheduled payment
    if (upcomingPayment) {
      actions.push(`Pagar ${upcomingPayment.name} vence el día ${upcomingPayment.due_day}`);
    } else {
      actions.push('📋 Revisa tus compromisos del mes');
    }

    // Action 3: frequent income
    if (topIncomeDesc) {
      actions.push(`Registra ingreso: ${topIncomeDesc}`);
    } else {
      actions.push('💰 Registra un ingreso');
    }

    // Action 4: spending insight for top category
    if (topCategory) {
      actions.push(`¿Cuánto gasté en ${topCategory.name} este mes?`);
    } else {
      actions.push('📊 ¿Cómo voy este mes?');
    }

    return Response.json({ actions });
  } catch {
    return Response.json({ actions: FALLBACK_ACTIONS });
  }
});
