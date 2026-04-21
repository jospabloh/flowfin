import { ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ProgressBar from '@/components/ProgressBar';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency } from '@/lib/formatters';

function getNextPayment(inv, paymentsMade) {
  const n = paymentsMade.length;
  if (n >= inv.total_payments) return null;
  const base = new Date(inv.start_date);
  const next = new Date(base);
  next.setMonth(next.getMonth() + n);
  if (inv.payment_day) next.setDate(Math.min(inv.payment_day, 28));
  const diff = Math.ceil((next - new Date()) / 86400000);
  return { number: n + 1, date: next, diff, remaining: inv.total_payments - n };
}

function statusColor(diff) {
  if (diff === undefined || diff === null) return 'bg-income';
  if (diff < 0) return 'bg-expense';
  if (diff <= 7) return 'bg-yellow-500';
  return 'bg-income';
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);

export default function InvestmentCard({ inv, allPayments, onSelect, onQuickPay }) {
  const { currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const fmt = v => formatCurrency(v, { locale, currency });
  const paid = allPayments.filter(p => p.investment_id === inv.id && (!p.date || p.date <= TODAY_ISO)).length;
  const next = getNextPayment(inv, allPayments.filter(p => p.investment_id === inv.id && (!p.date || p.date <= TODAY_ISO)));
  const done = paid >= inv.total_payments;
  const isDue = !done && next && next.diff <= 7;

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <button onClick={() => onSelect(inv)} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${done ? 'bg-income' : next ? statusColor(next.diff) : 'bg-muted'}`} />
            <div>
              <p className="text-sm font-semibold text-foreground">{inv.name}</p>
              {inv.type && <p className="text-xs text-muted-foreground">{inv.type}</p>}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        </div>
        <ProgressBar value={paid} max={inv.total_payments} className="mb-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{paid} / {inv.total_payments} pagos</span>
          {!done && next && (
            <span className={next.diff <= 7 ? 'text-yellow-500 font-semibold' : ''}>
              Próximo: {format(next.date, 'dd MMM', { locale: es })}
            </span>
          )}
          {done && <span className="text-income font-semibold">✓ Completado</span>}
        </div>
        {inv.payment_amount > 0 && (
          <p className="text-xs text-muted-foreground mt-1">{fmt(inv.payment_amount)} / pago</p>
        )}
      </button>
      {!done && next && (
        <div className="px-4 pb-3 pt-0">
          <button
            onClick={e => { e.stopPropagation(); onQuickPay(inv, paid); }}
            className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors
              ${isDue ? 'bg-expense/10 text-expense border border-expense/30 hover:bg-expense/20' : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'}`}>
            ✓ Confirmar pago #{paid + 1}{inv.payment_amount > 0 && ` · ${fmt(inv.payment_amount)}`}
          </button>
        </div>
      )}
    </div>
  );
}