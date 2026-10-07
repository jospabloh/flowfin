import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import AmountDisplay from '@/components/AmountDisplay';

/**
 * Balance-flow hero — the dashboard's thesis.
 * Net balance is the centerpiece; income and expense read as the two flows
 * that produce it (the "flow" in FlowFin). The ratio bar encodes real
 * information: how much of the month's income has already flowed back out.
 */
export default function DashboardSummaryCards({ income, expense, balance }) {
  const inflow = Math.max(income || 0, 0);
  const outflow = Math.max(expense || 0, 0);
  const positive = balance >= 0;

  // Share of income consumed by expenses (clamped). Drives the flow bar + caption.
  const consumed = inflow > 0 ? Math.min(outflow / inflow, 1) : (outflow > 0 ? 1 : 0);
  const consumedPct = Math.round(consumed * 100);
  const overspent = outflow > inflow;

  return (
    <section className="px-4 mb-4" aria-label="Balance del mes">
      <div className="relative overflow-hidden rounded-3xl border-2 border-border bg-card play-card">
        {/* Ambient accent: tinted by whether the family is net positive this month */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full blur-3xl opacity-50 ${
            positive ? 'bg-primary/15' : 'bg-expense/15'
          }`}
        />

        <div className="relative p-5">
          {/* Hero: net balance */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Balance del mes
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <AmountDisplay amount={balance} type={positive ? 'income' : 'expense'} size="xl" showSign={false} />
            <span className={`text-sm font-semibold ${positive ? 'text-income' : 'text-expense'}`}>
              {positive ? 'a favor' : 'en contra'}
            </span>
          </div>

          {/* Flow bar: how much of what came in has flowed back out */}
          <div className="mt-4">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                  overspent ? 'bg-expense' : 'bg-income'
                }`}
                style={{ width: `${Math.max(consumedPct, 2)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {overspent
                ? 'Gastaste más de lo que entró este mes'
                : `Has usado ${consumedPct}% de tus ingresos`}
            </p>
          </div>

          {/* The two flows that make up the balance */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              to="/Reports?type=income"
              className="group rounded-2xl border border-border/70 bg-background/40 p-3 transition-colors hover:border-income/40"
            >
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-income/10">
                  <ArrowDownLeft className="h-3 w-3 text-income" aria-hidden="true" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">Entró</span>
              </div>
              <div className="mt-1.5">
                <AmountDisplay amount={inflow} type="income" size="lg" showSign={false} />
              </div>
            </Link>

            <Link
              to="/Reports?type=expense"
              className="group rounded-2xl border border-border/70 bg-background/40 p-3 transition-colors hover:border-expense/40"
            >
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-expense/10">
                  <ArrowUpRight className="h-3 w-3 text-expense" aria-hidden="true" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">Salió</span>
              </div>
              <div className="mt-1.5">
                <AmountDisplay amount={outflow} type="expense" size="lg" showSign={false} />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
