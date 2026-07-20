import { AlertTriangle, XCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import NotificationBanner from '@/components/NotificationBanner';

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
        <NotificationBanner
          key={`crit-${i}`}
          to="/Budget"
          variant="danger"
          icon={XCircle}
          title={`${a.category?.icon} ${a.category?.name} — límite superado`}
          subtitle={`${fmt(a.spent)} gastado de ${fmt(a.budget)} (${Math.round(a.pct)}%)`}
        />
      ))}

      {warning.map((a, i) => (
        <NotificationBanner
          key={`warn-${i}`}
          to="/Budget"
          variant="warning"
          icon={AlertTriangle}
          title={`${a.category?.icon} ${a.category?.name} — ${Math.round(a.pct)}% del límite`}
          subtitle={`${fmt(a.spent)} gastado de ${fmt(a.budget)} presupuestados`}
        />
      ))}
    </div>
  );
}
