import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCatalog } from '@/hooks/useCatalog';
import { useFamily } from '@/lib/FamilyContext';
import { useMemory } from '@/hooks/useMemory';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { isWithinInterval, parseISO, startOfMonth } from 'date-fns';
import { PERIODS, getRange, CURRENT_MONTH } from '@/lib/dashboardConstants';

export function useDashboardData() {
  const { getUserPref, setUserPref } = useMemory();
  const [period, setPeriod] = useState(() => getUserPref('dashboard_period', 'month'));
  const [personFilter, setPersonFilter] = useState(() => getUserPref('dashboard_person', 'all'));
  const { familyId, currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const { categories, persons } = useCatalog(familyId);

  const { data: transactions = [], refetch: refetchTx } = useQuery({
    queryKey: ['transactions_dashboard', familyId],
    queryFn: () => base44.entities.Transaction.filter({ family_id: familyId }, '-date', 500),
    enabled: !!familyId,
    staleTime: 2 * 60 * 1000, // 2 min — avoid re-fetching on every navigation
  });

  const { refreshing } = usePullToRefresh(refetchTx);

  // Secondary queries — stale for 5 min to reduce API hammering
  const SECONDARY = { staleTime: 5 * 60 * 1000, enabled: !!familyId };
  const { data: investments = [] } = useQuery({ queryKey: ['investments', familyId], queryFn: () => base44.entities.Investment.filter({ family_id: familyId }), ...SECONDARY });
  const { data: investmentPayments = [] } = useQuery({ queryKey: ['investmentPayments', familyId], queryFn: () => base44.entities.InvestmentPayment.filter({ investment_id: { $exists: true } }, '-date', 200), ...SECONDARY });
  const { data: msiList = [] } = useQuery({ queryKey: ['msi', familyId], queryFn: () => base44.entities.MSI.filter({ family_id: familyId }), ...SECONDARY });
  const { data: msiPayments = [] } = useQuery({ queryKey: ['msiPayments', familyId], queryFn: () => base44.entities.MSIPayment.filter({ msi_id: { $exists: true } }, '-paid_date', 200), ...SECONDARY });
  const { data: rentalProperties = [] } = useQuery({ queryKey: ['rentalProperties', familyId], queryFn: () => base44.entities.RentalProperty.filter({ family_id: familyId }), ...SECONDARY });
  const { data: rentalPayments = [] } = useQuery({ queryKey: ['rentalPayments', familyId], queryFn: () => base44.entities.RentalPayment.filter({ property_id: { $exists: true } }, '-month', 100), ...SECONDARY });
  const { data: scheduledPayments = [] } = useQuery({ queryKey: ['scheduledPayments', familyId], queryFn: () => base44.entities.ScheduledPayment.filter({ family_id: familyId }), ...SECONDARY });
  const { data: scheduledRecords = [] } = useQuery({ queryKey: ['scheduledPaymentRecords', familyId], queryFn: () => base44.entities.ScheduledPaymentRecord.filter({ family_id: familyId }), ...SECONDARY });

  const pendingScheduled = useMemo(() => {
    const paidIds = new Set(scheduledRecords.filter(r => r.month === CURRENT_MONTH).map(r => r.scheduled_payment_id));
    return scheduledPayments.filter(p => p.is_active !== false && !paidIds.has(p.id));
  }, [scheduledPayments, scheduledRecords]);

  const pendingRentals = useMemo(() => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    return rentalProperties.filter(prop => {
      if (prop.is_active === false) return false;
      const paidThisMonth = rentalPayments.some(p => p.property_id === prop.id && p.month === CURRENT_MONTH && p.is_paid);
      if (paidThisMonth) return false;
      const payDay = prop.payment_day || 1;
      const diff = payDay - dayOfMonth;
      return diff <= 0 || diff <= 3;
    });
  }, [rentalProperties, rentalPayments]);

  const pendingInvestments = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return investments.filter(inv => {
      if (inv.is_active === false) return false;
      const paid = investmentPayments.filter(p => p.investment_id === inv.id && new Date(p.date) <= today).length;
      if (paid >= inv.total_payments) return false;
      const base = new Date(inv.start_date);
      const next = new Date(base);
      next.setMonth(next.getMonth() + paid);
      if (inv.payment_day) next.setDate(Math.min(inv.payment_day, 28));
      const diff = Math.ceil((next - today) / 86400000);
      return diff <= 7;
    });
  }, [investments, investmentPayments]);

  const range = getRange(period);

  const filtered = useMemo(() => (Array.isArray(transactions) ? transactions : []).filter(t => {
    if (!t.date) return false;
    const d = parseISO(t.date);
    const inRange = isWithinInterval(d, { start: range.start, end: range.end });
    const inPerson = personFilter === 'all' || t.person_id === personFilter;
    return inRange && inPerson;
  }), [transactions, period, personFilter, range.start, range.end]);

  const excludedCategoryIds = useMemo(
    () => new Set(categories.filter(c => c.exclude_from_totals).map(c => c.id)),
    [categories],
  );

  const filteredForTotals = useMemo(
    () => filtered.filter(t => !excludedCategoryIds.has(t.category_id)),
    [filtered, excludedCategoryIds],
  );

  const income = filteredForTotals.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const expense = filteredForTotals.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const balance = income - expense;

  const topCategories = useMemo(() => {
    const map = {};
    filteredForTotals.filter(t => t.type === 'expense').forEach(t => {
      const key = t.category_id || 'sin-cat';
      map[key] = (map[key] || 0) + (t.amount || 0);
    });
    return Object.entries(map)
      .map(([id, total]) => ({ cat: categories.find(c => c.id === id), total }))
      .sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filteredForTotals, categories]);

  const byPerson = useMemo(() => {
    const map = {};
    filtered.filter(t => t.type === 'expense').forEach(t => {
      const key = t.person_id || 'sin-persona';
      map[key] = (map[key] || 0) + (t.amount || 0);
    });
    return Object.entries(map).map(([id, value]) => ({
      person: persons.find(p => p.id === id),
      value,
      name: persons.find(p => p.id === id)?.name || 'Sin asignar',
    }));
  }, [filtered, persons]);

  const upcoming = useMemo(() => {
    const items = [];
    const today = new Date();
    const todayForUpcoming = new Date();
    todayForUpcoming.setHours(23, 59, 59, 999);
    investments.filter(i => i.is_active !== false).forEach(inv => {
      const paid = investmentPayments.filter(p => p.investment_id === inv.id && new Date(p.date) <= todayForUpcoming).length;
      if (paid < inv.total_payments) {
        const next = new Date(inv.start_date);
        next.setMonth(next.getMonth() + paid);
        if (inv.payment_day) next.setDate(Math.min(inv.payment_day, 28));
        const diff = Math.ceil((next - today) / 86400000);
        items.push({ type: 'investment', name: inv.name, amount: inv.payment_amount, date: next, diff, icon: '📈' });
      }
    });
    msiList.filter(m => m.is_active !== false).forEach(msi => {
      const paid = msiPayments.filter(p => p.msi_id === msi.id).length;
      if (paid < msi.total_months) {
        const next = new Date(msi.start_date);
        next.setMonth(next.getMonth() + paid);
        if (msi.billing_day) next.setDate(msi.billing_day);
        const diff = Math.ceil((next - today) / 86400000);
        items.push({ type: 'msi', name: msi.store, amount: msi.monthly_amount, date: next, diff, icon: '💳' });
      }
    });
    return items.sort((a, b) => a.diff - b.diff).slice(0, 4);
  }, [investments, investmentPayments, msiList, msiPayments]);

  const recent = filtered.slice(0, 5);

  // ── Goals ──
  const { data: goals = [] } = useQuery({
    queryKey: ['goals', familyId],
    queryFn: () => base44.entities.Goal.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
  });

  // ── Budget alerts: compare current-month spending per category vs limits ──
  const { data: categoryBudgets = [] } = useQuery({
    queryKey: ['category_budgets', familyId],
    queryFn: () => base44.entities.CategoryBudget.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 2 * 60 * 1000,
  });

  const budgetAlerts = useMemo(() => {
    if (!categoryBudgets.length) return [];
    // Always use current month transactions for budget alerts
    const monthStart = startOfMonth(new Date());
    const monthEnd = new Date();
    monthEnd.setHours(23, 59, 59, 999);
    const monthTx = (Array.isArray(transactions) ? transactions : []).filter(t => {
      if (!t.date || t.type !== 'expense') return false;
      const d = parseISO(t.date);
      return d >= monthStart && d <= monthEnd;
    });

    return categoryBudgets
      .map(b => {
        const spent = monthTx
          .filter(t => t.category_id === b.category_id)
          .reduce((s, t) => s + (t.amount || 0), 0);
        const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
        const category = categories.find(c => c.id === b.category_id);
        return { category, budget: b.amount, spent, pct };
      })
      .filter(a => a.pct >= 80)
      .sort((a, b) => b.pct - a.pct);
  }, [categoryBudgets, transactions, categories]);

  return {
    period, setPeriod,
    personFilter, setPersonFilter,
    refreshing,
    pendingScheduled, pendingInvestments, pendingRentals,
    income, expense, balance,
    topCategories, byPerson, upcoming, recent,
    categories, persons,
    currency, locale,
    setUserPref,
    PERIODS,
    budgetAlerts,
    goals,
    transactions,
  };
}