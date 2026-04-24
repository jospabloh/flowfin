import { Link } from 'react-router-dom';
import { Bell, TrendingUp, ChevronRight } from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

export default function DashboardPendingBanners({ pendingScheduled, pendingInvestments, pendingRentals }) {
  const t = useT();
  return (
    <>
      {pendingScheduled.length > 0 && (
        <Link to="/ScheduledPayments" className="mx-4 mb-3 flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-2xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
            <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              {pendingScheduled.length === 1
                ? t('dashboard.pendingScheduledOne').replace('{count}', 1)
                : t('dashboard.pendingScheduledMany').replace('{count}', pendingScheduled.length)}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 truncate">
              {pendingScheduled.slice(0, 3).map(p => p.name).join(', ')}{pendingScheduled.length > 3 ? '…' : ''}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
        </Link>
      )}

      {pendingInvestments.length > 0 && (
        <Link to="/Investments" className="mx-4 mb-3 flex items-center gap-3 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-700 rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-rose-800 dark:text-rose-300">
              {pendingInvestments.length === 1
                ? t('dashboard.pendingInvestmentsOne').replace('{count}', 1)
                : t('dashboard.pendingInvestmentsMany').replace('{count}', pendingInvestments.length)}
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-400 truncate">
              {pendingInvestments.slice(0, 3).map(p => p.name).join(', ')}{pendingInvestments.length > 3 ? '…' : ''}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-500 flex-shrink-0" />
        </Link>
      )}

      {pendingRentals.length > 0 && (
        <Link to="/Rentals" className="mx-4 mb-4 flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-2xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
            <span className="text-base">🏠</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
              {pendingRentals.length === 1
                ? t('dashboard.pendingRentalsOne').replace('{count}', 1)
                : t('dashboard.pendingRentalsMany').replace('{count}', pendingRentals.length)}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 truncate">
              {pendingRentals.slice(0, 3).map(p => p.name).join(', ')}{pendingRentals.length > 3 ? '…' : ''}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
        </Link>
      )}
    </>
  );
}
