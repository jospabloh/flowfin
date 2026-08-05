import { Loader2, CheckCircle2, Circle, Pencil, Trash2, Zap, PauseCircle, PlayCircle } from 'lucide-react';
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

function formatPausedUntil(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }
  return value;
}

// Single badge per card — a payment is either reconciled/auto-posted/paused,
// or still pending with an urgency level (due-soon/overdue), never both at
// once. isPaused takes priority over the due-date urgency calculation: while
// paused, the badge/color must NOT flash "Vencido" just because due_day
// already passed this month — the moment the pause lifts (auto-expires or
// someone hits Reanudar), it recalculates fresh from due_day vs today, since
// nothing here is a stored "next date" — it's derived every render.
function statusBadge(record, item, dueColor, isPaused) {
  const status = getRecordStatus(record);
  if (status === 'reconciled') return { label: 'Conciliado', variant: 'success' };
  if (status === 'posted') return { label: 'Auto', variant: 'info' };
  if (isPaused || status === 'skipped' || item.is_active === false) return { label: 'Pausado', variant: 'neutral' };
  if (dueColor === 'danger') return { label: 'Vencido', variant: 'danger' };
  if (dueColor === 'warning') return { label: 'Vence pronto', variant: 'warning' };
  return { label: 'Pendiente', variant: 'warning' };
}

export default function ScheduledPaymentItem({ item, isPaid, record, cat, isUnmarking, isAdmin, isPaused, hasHistory, onMarkPaid, onUnmark, onEdit, onDelete, onPauseUntil, onResume }) {
  const { currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const { confirmDelete, ConfirmDialog } = useDeleteConfirm();
  const color = isPaid ? 'success' : isPaused ? 'gray' : (item.is_active === false ? 'gray' : statusColor(item.due_day));
  const badge = statusBadge(record, item, isPaid ? null : color, isPaused && !isPaid);

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
          {isPaused && !isPaid && item.paused_until && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Pausado hasta {formatPausedUntil(item.paused_until)}{item.pause_reason ? ` · ${item.pause_reason}` : ''}
            </p>
          )}
          {item.is_active === false && hasHistory && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Con historial de pagos — se conserva por integridad de datos, no se puede eliminar del todo.
            </p>
          )}
          {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        {item.is_active !== false && canMark && !isPaused && (
          isPaid ? (
            <button onClick={() => onUnmark(item)} disabled={isUnmarking}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-success/15 text-success text-xs font-semibold min-h-[44px] disabled:opacity-60 transition-opacity active:opacity-70">
              {isUnmarking ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Desmarcando...</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Desmarcar</>}
            </button>
          ) : (
            <button onClick={() => onMarkPaid(item)}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm min-h-[44px] active:opacity-80 transition-opacity">
              <Circle className="w-3.5 h-3.5" /> Marcar como pagado
            </button>
          )
        )}
        {item.is_active !== false && isPaused && (isAdmin || canEdit) && (
          <button onClick={() => onResume(item)}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/30 text-xs font-semibold min-h-[44px] active:opacity-70 transition-opacity">
            <PlayCircle className="w-3.5 h-3.5" /> Reanudar
          </button>
        )}
        <div className="flex items-center gap-2">
          {(isAdmin || canEdit) && (
            <button onClick={() => onEdit(item)} aria-label="Editar" className="flex items-center justify-center w-11 h-11 rounded-xl bg-muted text-muted-foreground active:opacity-70 transition-opacity">
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {(isAdmin || canEdit) && !isPaused && (
            <button onClick={() => onPauseUntil(item)} aria-label="Pausar" className="flex items-center justify-center w-11 h-11 rounded-xl bg-muted text-muted-foreground active:opacity-70 transition-opacity">
              <PauseCircle className="w-4 h-4" />
            </button>
          )}
          {(isAdmin || canDelete) && !(item.is_active === false && hasHistory) && (
            <button onClick={handleDelete} aria-label="Eliminar compromiso" className="flex items-center justify-center w-11 h-11 rounded-xl bg-muted text-muted-foreground active:opacity-70 transition-opacity">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
