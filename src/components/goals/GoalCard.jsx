import { differenceInDays, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/formatters';
import { Pencil, Trash2, CheckCircle2 } from 'lucide-react';

export default function GoalCard({ goal, savedAmount, currency, locale, onEdit, onDelete }) {
  const fmt = (v) => formatCurrency(v, { locale, currency });
  const total = (goal.manual_saved || 0) + (savedAmount || 0);
  const pct = goal.target_amount > 0 ? Math.min((total / goal.target_amount) * 100, 100) : 0;
  const completed = pct >= 100;

  let daysLeft = null;
  let deadlineLabel = null;
  if (goal.deadline) {
    daysLeft = differenceInDays(parseISO(goal.deadline), new Date());
    deadlineLabel = format(parseISO(goal.deadline), "d MMM yyyy", { locale: es });
  }

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: `${goal.color || '#059669'}20` }}>
          {goal.icon || '🎯'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{goal.name}</p>
          {goal.description && <p className="text-xs text-muted-foreground truncate">{goal.description}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg bg-muted text-rose-500 hover:bg-rose-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">
            {fmt(total)} <span className="text-foreground font-semibold">/ {fmt(goal.target_amount)}</span>
          </span>
          <span className="text-xs font-bold" style={{ color: completed ? '#059669' : goal.color || '#059669' }}>
            {completed ? '✓ ¡Meta alcanzada!' : `${Math.round(pct)}%`}
          </span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              backgroundColor: completed ? '#059669' : (goal.color || '#059669'),
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center justify-between">
        {goal.deadline ? (
          <span className={`text-xs ${daysLeft < 0 ? 'text-rose-500 font-semibold' : daysLeft <= 30 ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
            {daysLeft < 0 ? `Venció hace ${Math.abs(daysLeft)} días` : daysLeft === 0 ? 'Vence hoy' : `${daysLeft} días — ${deadlineLabel}`}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sin fecha límite</span>
        )}
        {completed && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
      </div>
    </div>
  );
}