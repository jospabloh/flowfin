/**
 * Segmented strip — one bar per cuota. Paid cuotas fill in income teal, the
 * next due one is highlighted (primary, or expense if overdue), everything
 * after stays muted. Replaces the flat percentage ProgressBar with something
 * that encodes which specific installments are done, not just a ratio —
 * the thing people actually want to know at a glance for an installment plan.
 */
export default function InvestmentTimeline({ total, paidCount, overdue = false, size = 'md', onNextClick, className = '' }) {
  if (!total || total <= 0) return null;
  const segments = Array.from({ length: total }, (_, i) => i);
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className={`flex items-center gap-[3px] w-full ${height} ${className}`}>
      {segments.map(i => {
        const isPaid = i < paidCount;
        const isNext = i === paidCount;
        const base = 'flex-1 min-w-[3px] rounded-full transition-colors duration-300';

        if (isPaid) return <div key={i} className={`${base} bg-income`} />;
        if (isNext) {
          return (
            <button
              key={i}
              type="button"
              onClick={onNextClick}
              disabled={!onNextClick}
              aria-label={`Cuota ${i + 1}, pendiente`}
              className={`${base} animate-pulse ${overdue ? 'bg-expense' : 'bg-primary'} ${onNextClick ? 'cursor-pointer' : ''}`}
            />
          );
        }
        return <div key={i} className={`${base} bg-muted`} />;
      })}
    </div>
  );
}
