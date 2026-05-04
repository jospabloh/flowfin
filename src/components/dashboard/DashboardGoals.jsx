import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import { ChevronRight, Target } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

function GoalMini({ goal, savedAmount, currency, locale }) {
  const fmt = (v) => formatCurrency(v, { locale, currency });
  const total = (goal.manual_saved || 0) + (savedAmount || 0);
  const pct = goal.target_amount > 0 ? Math.min((total / goal.target_amount) * 100, 100) : 0;
  const completed = pct >= 100;
  const daysLeft = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;

  return (
    <div className="px-4 py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ backgroundColor: `${goal.color || '#059669'}20` }}>
          {goal.icon || '🎯'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-foreground truncate">{goal.name}</p>
            <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color: completed ? '#059669' : goal.color || '#059669' }}>
              {Math.round(pct)}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: completed ? '#059669' : (goal.color || '#059669') }} />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">{fmt(total)} / {fmt(goal.target_amount)}</span>
            {daysLeft !== null && (
              <span className={`text-[10px] ${daysLeft < 0 ? 'text-rose-500' : daysLeft <= 30 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                {daysLeft < 0 ? 'Vencida' : daysLeft === 0 ? 'Hoy' : `${daysLeft}d`}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardGoals({ goals, transactions, currency, locale }) {
  if (!goals || goals.length === 0) return null;

  // Calculate saved amount per goal based on linked category transactions
  function getSaved(goal) {
    if (!goal.category_id) return 0;
    return transactions
      .filter(t => t.category_id === goal.category_id && t.type === 'income')
      .reduce((s, t) => s + (t.amount || 0), 0);
  }

  const active = goals.filter(g => g.is_active !== false);
  if (active.length === 0) return null;

  return (
    <div className="mx-4 mb-4">
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Metas financieras</h3>
          </div>
          <Link to="/Goals" className="flex items-center gap-1 text-xs text-primary font-semibold">
            Ver todas <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {active.slice(0, 3).map(g => (
          <GoalMini key={g.id} goal={g} savedAmount={getSaved(g)} currency={currency} locale={locale} />
        ))}
      </div>
    </div>
  );
}