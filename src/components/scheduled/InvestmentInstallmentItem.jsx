import { Circle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AmountDisplay from '@/components/AmountDisplay';
import StatusBadge from '@/components/StatusBadge';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency } from '@/lib/formatters';
import { usePermission } from '@/lib/permissions/usePermission';

const colorMap = {
  success: 'bg-success/5 border-success/25 dark:bg-success/10',
  warning: 'bg-warning/5 border-warning/25 dark:bg-warning/10',
  danger: 'bg-destructive/5 border-destructive/25 dark:bg-destructive/10',
};
const dotMap = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-destructive' };

// Una cuota de inversión en "Pagos del Mes". Deliberadamente NO reusa
// ScheduledPaymentItem: ahí las acciones son editar / pausar / archivar de un
// ScheduledPayment, y una cuota no es ninguna de esas cosas — se confirma, y
// el resto se administra desde Inversiones. Lo que sí comparte es el lenguaje
// visual (color por urgencia, punto, badge) para que un pendiente se lea igual
// venga de donde venga.
export default function InvestmentInstallmentItem({ inv, next, paidPayment, onMarkPaid }) {
  const { currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const { can_write: canPay } = usePermission('investment.payments.add');

  const isPaid = !!paidPayment;
  const color = isPaid ? 'success' : next.diff < 0 ? 'danger' : next.diff <= 3 ? 'warning' : 'success';
  const badge = isPaid ? { label: 'Conciliado', variant: 'success' }
    : next.diff < 0 ? { label: 'Vencido', variant: 'danger' }
    : next.diff <= 3 ? { label: 'Vence pronto', variant: 'warning' }
    : { label: 'Pendiente', variant: 'warning' };
  const amount = isPaid ? paidPayment.amount : inv.payment_amount;

  return (
    <div className={`rounded-2xl border p-4 transition-all ${colorMap[color]}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">📈</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-foreground">{inv.name}</p>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotMap[color]}`} />
            <StatusBadge variant={badge.variant}>{badge.label}</StatusBadge>
            <StatusBadge variant="info" icon={TrendingUp}>Inversión</StatusBadge>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Cuota {isPaid ? paidPayment.payment_number : next.number} de {inv.total_payments}
              {!isPaid && ` · vence el ${format(next.date, "d 'de' MMM", { locale: es })}`}
            </p>
            {amount > 0 && <span className="text-xs font-semibold text-foreground">· <AmountDisplay amount={amount} type="expense" size="sm" showSign={false} /></span>}
          </div>
          {isPaid && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Pagado el {paidPayment.date} · {formatCurrency(paidPayment.amount, { locale, currency })}
            </p>
          )}
        </div>
      </div>
      {!isPaid && canPay && (
        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => onMarkPaid(inv, next)}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm min-h-[44px] active:opacity-80 transition-opacity">
            <Circle className="w-3.5 h-3.5" /> Marcar como pagado
          </button>
        </div>
      )}
    </div>
  );
}
