import { ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import InvestmentTimeline from '@/components/investments/InvestmentTimeline';
import StatusBadge from '@/components/StatusBadge';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency } from '@/lib/formatters';
import { countPaidInstallments, getNextInstallment } from '@/lib/investmentSchedule';
import { usePermission } from '@/lib/permissions/usePermission';

function StatusPill({ done, next }) {
  if (done) return <StatusBadge variant="success">Completado</StatusBadge>;
  if (!next) return null;
  if (next.diff < 0) return <StatusBadge variant="danger">Vencido</StatusBadge>;
  if (next.diff <= 7) return <StatusBadge variant="warning">Vence pronto</StatusBadge>;
  return <StatusBadge variant="neutral">Al día</StatusBadge>;
}

export default function InvestmentCard({ inv, allPayments, onSelect, onQuickPay }) {
  const { currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const fmt = v => formatCurrency(v, { locale, currency });
  const paid = countPaidInstallments(allPayments, inv.id);
  const next = getNextInstallment(inv, paid);
  const done = paid >= inv.total_payments;
  const isDue = !done && next && next.diff <= 7;
  const { can_write: canPay } = usePermission('investment.payments.add');

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <button onClick={() => onSelect(inv)} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">{inv.name}</p>
              <StatusPill done={done} next={next} />
            </div>
            {inv.type && <p className="text-xs text-muted-foreground mt-0.5">{inv.type}</p>}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        </div>
        <InvestmentTimeline total={inv.total_payments} paidCount={paid} overdue={!!next && next.diff < 0} className="mb-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
          <span className="font-medium text-foreground">{paid}<span className="text-muted-foreground font-normal"> / {inv.total_payments} cuotas</span></span>
          {!done && next && (
            <span className={next.diff < 0 ? 'text-expense font-semibold' : next.diff <= 7 ? 'text-warning font-semibold' : ''}>
              {next.diff < 0 ? `Venció hace ${Math.abs(next.diff)}d` : `Próximo: ${format(next.date, 'dd MMM', { locale: es })}`}
            </span>
          )}
        </div>
        {inv.payment_amount > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">{fmt(inv.payment_amount)} por cuota</p>
        )}
      </button>
      {canPay && !done && next && (
        <div className="px-4 pb-3 pt-0">
          <button
            onClick={e => { e.stopPropagation(); onQuickPay(inv, paid); }}
            className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-colors touch-target
              ${isDue ? 'bg-expense/10 text-expense border border-expense/30 hover:bg-expense/20' : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'}`}>
            Registrar cuota #{paid + 1}{inv.payment_amount > 0 && ` · ${fmt(inv.payment_amount)}`}
          </button>
        </div>
      )}
    </div>
  );
}