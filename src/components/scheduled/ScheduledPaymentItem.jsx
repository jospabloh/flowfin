import { Loader2, CheckCircle2, Circle, Pencil, Trash2 } from 'lucide-react';
import AmountDisplay from '@/components/AmountDisplay';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency } from '@/lib/formatters';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';

const TODAY = new Date();
const CURRENT_MONTH = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`;

function statusColor(dueDay) {
  const diff = dueDay - TODAY.getDate();
  if (diff < 0) return 'red';
  if (diff <= 3) return 'amber';
  return 'green';
}

const colorMap = {
  green: 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800',
  amber: 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-700',
  red: 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800',
  gray: 'bg-muted/50 border-border',
};
const dotMap = {
  green: 'bg-green-500', amber: 'bg-amber-400', red: 'bg-red-500', gray: 'bg-muted-foreground/30',
};

export default function ScheduledPaymentItem({ item, isPaid, record, cat, isUnmarking, isAdmin, persons, onMarkPaid, onUnmark, onEdit, onDelete }) {
  const { currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const { confirmDelete, ConfirmDialog } = useDeleteConfirm();
  const color = isPaid ? 'green' : (item.is_active === false ? 'gray' : statusColor(item.due_day));

  const handleDelete = async () => {
    if (await confirmDelete(`¿Eliminar "${item.name}"?`)) onDelete(item.id);
  };

  return (
    <div className={`rounded-2xl border p-4 transition-all ${colorMap[color]}`}>
      <ConfirmDialog />
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{item.icon || '💰'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-bold ${item.is_active === false ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{item.name}</p>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotMap[color]}`} />
            {isPaid && <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">✓ Pagado</span>}
            {!isPaid && item.is_active !== false && color === 'red' && <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">Vencido</span>}
            {!isPaid && item.is_active !== false && color === 'amber' && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">Vence pronto</span>}
            {item.is_active === false && <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Inactivo</span>}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs text-muted-foreground">Día {item.due_day} de cada mes</p>
            {cat && <span className="text-xs text-muted-foreground">· {cat.icon} {cat.name}</span>}
            {item.amount > 0 && <span className="text-xs font-semibold text-foreground">· <AmountDisplay amount={item.amount} type="expense" size="sm" showSign={false} /></span>}
          </div>
          {isPaid && record && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Pagado el {record.paid_date}{record.paid_by ? ` por ${record.paid_by}` : ''}{record.amount_paid ? ` · ${formatCurrency(record.amount_paid, { locale, currency })}` : ''}
            </p>
          )}
          {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
        </div>
      </div>
      <div className="flex gap-2 mt-3 flex-wrap">
        {item.is_active !== false && (
          isPaid ? (
            <button onClick={() => onUnmark(item)} disabled={isUnmarking}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-semibold min-h-[44px] min-w-[44px] disabled:opacity-60 transition-opacity active:opacity-70">
              {isUnmarking ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Desmarcando...</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Desmarcar</>}
            </button>
          ) : (
            <button onClick={() => onMarkPaid(item)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm min-h-[44px] min-w-[44px] active:opacity-80 transition-opacity">
              <Circle className="w-3.5 h-3.5" /> Marcar como pagado
            </button>
          )
        )}
        {isAdmin && (
          <>
            <button onClick={() => onEdit(item)} className="flex items-center justify-center px-3 py-2.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium min-h-[44px] min-w-[44px] active:opacity-70 transition-opacity">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={handleDelete} aria-label="Eliminar compromiso"
              className="flex items-center justify-center px-3 py-2.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium min-h-[44px] min-w-[44px] active:opacity-70 transition-opacity">
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}