import Spinner from '@/components/Spinner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PageHeader from '@/components/PageHeader';
import ThemeToggle from '@/components/ThemeToggle';
import { MessageCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useDashboardData } from '@/hooks/useDashboardData';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import DashboardPendingBanners from '@/components/dashboard/DashboardPendingBanners';
import DashboardBudgetAlerts from '@/components/dashboard/DashboardBudgetAlerts';
import DashboardSummaryCards from '@/components/dashboard/DashboardSummaryCards';
import DashboardTopCategoriesChart from '@/components/dashboard/DashboardTopCategoriesChart';
import DashboardExpenseByPersonChart from '@/components/dashboard/DashboardExpenseByPersonChart';
import DashboardRecentMovements from '@/components/dashboard/DashboardRecentMovements';
import DashboardUpcomingPayments from '@/components/dashboard/DashboardUpcomingPayments';
import { useCanView } from '@/lib/permissions/usePermission';
import TDCSnapshotCard from '@/components/dashboard/TDCSnapshotCard';
import DashboardActiveTrips from '@/components/dashboard/DashboardActiveTrips';
import DashboardGoals from '@/components/dashboard/DashboardGoals';

export default function Dashboard() {
  const {
    period, setPeriod,
    personFilter, setPersonFilter,
    refreshing,
    pendingScheduled, pendingInvestments, pendingRentals,
    income, expense, balance,
    topCategories, byPerson, upcoming, recent,
    categories, persons,
    currency, locale,
    setUserPref,
    budgetAlerts,
    goals,
    transactions,
  } = useDashboardData();

  const canViewSummary   = useCanView('dashboard.view.summary');
  const canViewUpcoming  = useCanView('dashboard.view.upcoming');
  const canViewAnalytics = useCanView('dashboard.view.analytics');
  const canViewRecent    = useCanView('dashboard.view.recent');
  const canViewAlerts    = useCanView('dashboard.view.alerts');
  const canViewFilters   = useCanView('dashboard.view.filters');

  return (
    <div className="pb-4">
      {refreshing && (
        <div className="flex justify-center py-3">
          <Spinner size="sm" />
        </div>
      )}

      <PageHeader
        title={format(new Date(), 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())}
        subtitle="Resumen familiar"
        action={<div className="md:hidden"><ThemeToggle /></div>}
      />

      {canViewFilters && (
        <DashboardFilters
          period={period}
          setPeriod={setPeriod}
          personFilter={personFilter}
          setPersonFilter={setPersonFilter}
          persons={persons}
          setUserPref={setUserPref}
        />
      )}

      {canViewAlerts && (
        <DashboardPendingBanners
          pendingScheduled={pendingScheduled}
          pendingInvestments={pendingInvestments}
          pendingRentals={pendingRentals}
        />
      )}

      <DashboardBudgetAlerts alerts={budgetAlerts} currency={currency} locale={locale} />

      {canViewSummary && (
        <DashboardSummaryCards income={income} expense={expense} balance={balance} />
      )}

      {/* WhatsApp Finia banner */}
      <div className="mx-4 mb-3 mt-1">
        <a
          href={base44.agents.getWhatsAppConnectURL('finia')}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/25 hover:bg-[#25D366]/20 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center flex-shrink-0 shadow-sm">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#128C7E] dark:text-[#25D366] leading-tight">Finia en WhatsApp</p>
            <p className="text-xs text-muted-foreground leading-tight">Registra gastos desde WhatsApp</p>
          </div>
          <span className="text-xs font-semibold text-[#25D366] flex-shrink-0">Abrir →</span>
        </a>
      </div>

      <TDCSnapshotCard />
      <DashboardActiveTrips />
      <DashboardGoals goals={goals} transactions={transactions} currency={currency} locale={locale} />

      {canViewAnalytics && (
        <DashboardTopCategoriesChart
          topCategories={topCategories}
          expense={expense}
          currency={currency}
          locale={locale}
        />
      )}

      {canViewAnalytics && (
        <DashboardExpenseByPersonChart
          byPerson={byPerson}
          currency={currency}
          locale={locale}
        />
      )}

      {canViewRecent && (
        <DashboardRecentMovements
          recent={recent}
          categories={categories}
          persons={persons}
        />
      )}

      {canViewUpcoming && (
        <DashboardUpcomingPayments upcoming={upcoming} />
      )}
    </div>
  );
}