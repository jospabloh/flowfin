import { Loader2, CheckCircle2, Circle, Pencil, Trash2, Zap } from 'lucide-react';
import AmountDisplay from '@/components/AmountDisplay';
import StatusBadge from '@/components/StatusBadge';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency } from '@/lib/formatters';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm.jsx';
import { usePermission } from '@/lib/permissions/usePermission';

const TODAY = new Date();

function statusColor(dueDay) {
  const diff = dueDay - TODAY.getDate();
  if (diff < 0) return 'danger';
  if (diff <= 3) return 'warning';
  return 'success';
}

const colorMap = {
  success: 'bg-success/5 border-success/25 dark:bg-success/10',
  warning: 'bg-warning/5 border-warning/25 dark:bg-warning/10',
  danger: 'bg-destructive/5 border-destructive/25 dark:bg-destructive/10',
  gray: 'bg-muted/50 border-border',
};
const dotMap = {
  success: 'bg-success', warning: 'bg-warning', danger: 'bg-destructive', gray: 'bg-muted-foreground/30',
};

function getRecordStatus(record) {
  if (!record) return 'pending';
  return record.status || 'reconciled';
}

// Single badge per card — a payment is either reconciled/auto-posted/paused,
// or still pending with an urgency level (due-soon/overdue), never both at once.
function statusBadge(record, item, dueColor) {
  const status = getRecordStatus(record);
  if (status === 'reconciled') return { label: 'Conciliado', variant: 'success' };
  if (status === 'posted') return { label: 'Auto', variant: 'info' };
  if (status === 'skipped' || item.is_active === false) return { label: 'Pausado', variant: 'neutral' };
  if (dueColor === 'danger') return { label: 'Vencido', variant: 'danger' };
  if (dueColor === 'warning') return { label: 'Vence pronto', variant: 'warning' };
  return { label: 'Pendiente', variant: 'warning' };
}

export default function ScheduledPaymentItem({ item, isPaid, record, cat, isUnmarking, isAdmin, isPaused, onMarkPaid, onUnmark, onEdit, onDelete, onPauseOneMonth, onPauseUntil, onResume }) {
  const { currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const { confirmDelete, ConfirmDialog } = useDeleteConfirm();
  const color = isPaid ? 'success' : (item.is_active === false ? 'gray' : statusColor(item.due_day));
  const badge = statusBadge(record, item, isPaid ? null : color);

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
            <StatusBadge variant={badge.variant}>{badge.label}</StatusBadge>
            {item.automation_mode === 'auto' && badge.label !== 'Auto' && (
              <StatusBadge variant="info" icon={Zap}>Domiciliado</StatusBadge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs text-muted-foreground">Día {item.due_day} de cada mes</p>
            {cat && <span className="text-xs text-muted-foreground">· {cat.icon} {cat.name}</span>}
            {!cat && !isPaid && item.is_active !== false && (
              <span className="text-xs text-destructive">· Sin categoría (no se registrará en Movimientos)</span>
            )}
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
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-success/15 text-success text-xs font-semibold min-h-[44px] min-w-[44px] disabled:opacity-60 transition-opacity active:opacity-70">
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
