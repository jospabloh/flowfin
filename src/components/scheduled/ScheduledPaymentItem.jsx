import { Loader2, CheckCircle2, Circle, Pencil, Trash2, Zap } from 'lucide-react';
import AmountDisplay from '@/components/AmountDisplay';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency } from '@/lib/formatters';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm.jsx';
import { usePermission } from '@/lib/permissions/usePermission';

const TODAY = new Date();

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

function getRecordStatus(record) {
  if (!record) return 'pending';
  return record.status || 'reconciled';
}

function statusBadge(record, item) {
  const status = getRecordStatus(record);
  if (status === 'reconciled') return { label: 'Conciliado', cls: 'text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full' };
  if (status === 'posted') return { label: 'Auto', cls: 'text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full' };
  if (status === 'skipped' || item.is_active === false) return { label: 'Pausado', cls: 'text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full' };
  return { label: 'Pendiente', cls: 'text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full' };
}

export default function ScheduledPaymentItem({ item, isPaid, record, cat, isUnmarking, isAdmin, isPaused, onMarkPaid, onUnmark, onEdit, onDelete, onPauseOneMonth, onPauseUntil, onResume }) {
  const { currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const { confirmDelete, ConfirmDialog } = useDeleteConfirm();
  const color = isPaid ? 'green' : (item.is_active === false ? 'gray' : statusColor(item.due_day));
  const badge = statusBadge(record, item);

  const { can_write: canMark }    = usePermission('scheduled.mark.action');
  const { can_modify: canEdit }   = usePermission('scheduled.manage.edit');
  const { can_delete: canDelete } = usePermission('scheduled.manage.delete');

  const handleDelete = async () => {
    if (await confirmDelete(`¿Eliminar "${item.name}"?`)) onDelete(item);
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
            <span className={badge.cls}>{badge.label}</span>
            {item.automation_mode === 'auto' && badge.label !== 'Auto' && (
              <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" /> Domiciliado
              </span>
            )}
            {!isPaid && item.is_active !== false && color === 'red' && <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">Vencido</span>}
            {!isPaid && item.is_active !== false && color === 'amber' && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">Vence pronto</span>}
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
        {item.is_active !== false && canMark && (
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
        {(isAdmin || canEdit) && (
          <>
            <button onClick={() => onEdit(item)} className="flex items-center justify-center px-3 py-2.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium min-h-[44px] min-w-[44px] active:opacity-70 transition-opacity">
              <Pencil className="w-4 h-4" />
            </button>
            {!isPaused ? (
              <>
                <button onClick={() => onPauseOneMonth(item)} className="px-3 py-2.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium min-h-[44px] active:opacity-70 transition-opacity">
                  Pausar 1 mes
                </button>
                <button onClick={() => onPauseUntil(item)} className="px-3 py-2.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium min-h-[44px] active:opacity-70 transition-opacity">
                  Pausar hasta…
                </button>
              </>
            ) : (
              <button onClick={() => onResume(item)} className="px-3 py-2.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium min-h-[44px] active:opacity-70 transition-opacity">
                Reanudar
              </button>
            )}
          </>
        )}
        {(isAdmin || canDelete) && (
          <button onClick={handleDelete} aria-label="Eliminar compromiso"
            className="flex items-center justify-center px-3 py-2.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium min-h-[44px] min-w-[44px] active:opacity-70 transition-opacity">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
