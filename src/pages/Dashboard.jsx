import Spinner from '@/components/Spinner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PageHeader from '@/components/PageHeader';
import ThemeToggle from '@/components/ThemeToggle';
import { useDashboardData } from '@/hooks/useDashboardData';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import DashboardPendingBanners from '@/components/dashboard/DashboardPendingBanners';
import DashboardSummaryCards from '@/components/dashboard/DashboardSummaryCards';
import DashboardTopCategoriesChart from '@/components/dashboard/DashboardTopCategoriesChart';
import DashboardExpenseByPersonChart from '@/components/dashboard/DashboardExpenseByPersonChart';
import DashboardRecentMovements from '@/components/dashboard/DashboardRecentMovements';
import DashboardUpcomingPayments from '@/components/dashboard/DashboardUpcomingPayments';
import { useCanView } from '@/lib/permissions/usePermission';
import TDCSnapshotCard from '@/components/dashboard/TDCSnapshotCard';
import DashboardActiveTrips from '@/components/dashboard/DashboardActiveTrips';

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

      {canViewSummary && (
        <DashboardSummaryCards income={income} expense={expense} balance={balance} />
      )}

      <TDCSnapshotCard />
      <DashboardActiveTrips />

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