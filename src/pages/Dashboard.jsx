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

      <DashboardFilters
        period={period}
        setPeriod={setPeriod}
        personFilter={personFilter}
        setPersonFilter={setPersonFilter}
        persons={persons}
        setUserPref={setUserPref}
      />

      <DashboardPendingBanners
        pendingScheduled={pendingScheduled}
        pendingInvestments={pendingInvestments}
        pendingRentals={pendingRentals}
      />

      <DashboardSummaryCards income={income} expense={expense} balance={balance} />

      <DashboardTopCategoriesChart
        topCategories={topCategories}
        expense={expense}
        currency={currency}
        locale={locale}
      />

      <DashboardExpenseByPersonChart
        byPerson={byPerson}
        currency={currency}
        locale={locale}
      />

      <DashboardRecentMovements
        recent={recent}
        categories={categories}
        persons={persons}
      />

      <DashboardUpcomingPayments upcoming={upcoming} />
    </div>
  );
}