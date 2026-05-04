import { Link } from 'react-router-dom';
import { AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

/**
 * Shows visual alerts when category spending reaches 80% or 100% of its budget.
 * @param {Array} alerts - [{ category, budget, spent, pct }]
 */
export default function DashboardBudgetAlerts({ alerts, currency, locale }) {
  if (!alerts || alerts.length === 0) return null;

  const fmt = (v) => formatCurrency(v, { locale, currency });

  const critical = alerts.filter(a => a.pct >= 100);
  const warning  = alerts.filter(a => a.pct >= 80 && a.pct < 100);

  return (
    <div className="px-4 mb-3 space-y-2">
      {critical.map((a, i) => (
        <Link key={`crit-${i}`} to="/Budget"
          className="flex items-center gap-3 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-700 rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center flex-shrink-0">
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-rose-800 dark:text-rose-300">
              {a.category?.icon} {a.category?.name} — límite superado
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-400">
              {fmt(a.spent)} gastado de {fmt(a.budget)} ({Math.round(a.pct)}%)
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-500 flex-shrink-0" />
        </Link>
      ))}

      {warning.map((a, i) => (
        <Link key={`warn-${i}`} to="/Budget"
          className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-2xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              {a.category?.icon} {a.category?.name} — {Math.round(a.pct)}% del límite
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {fmt(a.spent)} gastado de {fmt(a.budget)} presupuestados
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
        </Link>
      ))}
    </div>
  );
}