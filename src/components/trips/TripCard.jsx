import { useMemo } from 'react';
import { MapPin, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { useFamily } from '@/lib/FamilyContext';

function daysRemaining(endDate) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const end = new Date(endDate + 'T12:00:00');
  const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  return diff;
}

function formatDateRange(start, end) {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const opts = { day: 'numeric', month: 'short' };
  if (sameMonth) {
    return `${s.getDate()} — ${e.toLocaleDateString('es-MX', opts)}`;
  }
  return `${s.toLocaleDateString('es-MX', opts)} — ${e.toLocaleDateString('es-MX', opts)}`;
}

function BudgetBar({ spent, total, currency, locale }) {
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="mt-2 space-y-1">
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {formatCurrency(spent, { locale, currency, decimals: 0 })} / {formatCurrency(total, { locale, currency, decimals: 0 })} ({pct.toFixed(0)}%)
      </p>
    </div>
  );
}

function PersonAvatars({ ids, persons }) {
  if (!ids?.length) return null;
  const matched = ids.map(id => persons.find(p => p.id === id)).filter(Boolean);
  return (
    <div className="flex -space-x-1.5">
      {matched.slice(0, 5).map(p => (
        <div
          key={p.id}
          title={p.name}
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-card flex-shrink-0"
          style={{ backgroundColor: p.color || '#059669' }}
        >
          {p.avatar_initial || (p.name?.[0] || '?').toUpperCase()}
        </div>
      ))}
      {matched.length > 5 && (
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground ring-2 ring-card">
          +{matched.length - 5}
        </div>
      )}
    </div>
  );
}

export default function TripCard({ trip, transactions = [], persons = [], onClick }) {
  const { currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';

  const spent = useMemo(() => {
    return transactions
      .filter(t => t.trip_id === trip.id && t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions, trip.id]);

  const remaining = daysRemaining(trip.end_date);
  const isActive = trip.status === 'active';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] transition-transform"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-foreground text-sm truncate">{trip.name}</h3>
          {trip.destination_countries?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {trip.destination_countries.map(c => (
                <span key={c} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                  <MapPin className="w-2.5 h-2.5" />{c}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
          trip.status === 'closed'
            ? 'bg-muted text-muted-foreground'
            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
        }`}>
          {trip.status === 'closed' ? 'Cerrado' : 'Activo'}
        </span>
      </div>

      {/* Date + days */}
      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
        <Calendar className="w-3 h-3 flex-shrink-0" />
        <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
        {isActive && (
          <span className="ml-1 font-medium text-foreground">
            · {remaining > 1 ? `${remaining} días restantes` : remaining === 1 ? 'Hoy es el último día' : remaining === 0 ? 'Hoy termina' : 'Terminado'}
          </span>
        )}
      </div>

      {/* Budget bar */}
      {trip.budget_amount > 0 && (
        <BudgetBar spent={spent} total={trip.budget_amount} currency={trip.budget_currency || currency} locale={locale} />
      )}

      {/* Footer: currencies + participants */}
      <div className="flex items-center justify-between mt-3 gap-2">
        {trip.currencies?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {trip.currencies.map(c => (
              <span key={c} className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-mono font-semibold">{c}</span>
            ))}
          </div>
        )}
        <PersonAvatars ids={trip.participant_person_ids} persons={persons} />
      </div>
    </button>
  );
}
