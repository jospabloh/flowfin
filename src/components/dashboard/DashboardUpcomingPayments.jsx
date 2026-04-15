import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AmountDisplay from '@/components/AmountDisplay';

export default function DashboardUpcomingPayments({ upcoming }) {
  if (!upcoming.length) return null;

  return (
    <div className="mx-4 bg-card border border-border rounded-2xl p-4 mb-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3">Próximos pagos</h3>
      {upcoming.map((item, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
          <span className="text-xl">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {format(item.date, 'dd MMM', { locale: es })} · {item.diff <= 0 ? '¡Hoy!' : item.diff === 1 ? 'Mañana' : `En ${item.diff} días`}
            </p>
          </div>
          {item.amount && <AmountDisplay amount={item.amount} type="expense" size="sm" showSign={false} />}
        </div>
      ))}
    </div>
  );
}