import { Loader2, Check, Pencil, Trash2 } from 'lucide-react';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency } from '@/lib/formatters';
import { usePermission } from '@/lib/permissions/usePermission';

const THIS_MONTH = new Date().toISOString().slice(0, 7);

export default function RentalPropertyCard({ prop, rentalPayments, unmarkingId, deleteMutationPending, onEdit, onDelete, onPay, onUnmark }) {
  const { currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const fmt = amount => formatCurrency(amount, { locale, currency });
  const propPayments = rentalPayments.filter(p => p.property_id === prop.id);
  const thisMonthRecord = propPayments.find(p => p.month === THIS_MONTH && p.is_paid);
  const paidThisMonth = !!thisMonthRecord;
  const totalCollected = propPayments.filter(p => p.is_paid).reduce((s, p) => s + (p.amount || 0), 0);

  const { can_modify: canEdit }   = usePermission('rental.property.edit');
  const { can_delete: canDelete } = usePermission('rental.property.delete');
  const { can_write: canRecord }  = usePermission('rental.payments.record');
  const { can_modify: canReverse }= usePermission('rental.payments.reverse');

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${paidThisMonth ? 'bg-income' : 'bg-yellow-500'}`} />
            <p className="text-sm font-semibold text-foreground truncate">{prop.name}</p>
          </div>
          {prop.tenant_name && <p className="text-xs text-muted-foreground mt-0.5">Inquilino: {prop.tenant_name}</p>}
          {prop.address && <p className="text-xs text-muted-foreground truncate">{prop.address}</p>}
          {prop.payment_day && <p className="text-xs text-muted-foreground">Día de cobro: {prop.payment_day}</p>}
        </div>
        <div className="text-right ml-3 flex-shrink-0">
          <p className="text-sm font-bold text-foreground">{fmt(prop.base_rent)}/mes</p>
          <p className={`text-xs font-medium ${paidThisMonth ? 'text-income' : 'text-yellow-500'}`}>
            {paidThisMonth ? '✓ Cobrado este mes' : '⏳ Pendiente'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">Total cobrado: {fmt(totalCollected)}</p>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button onClick={() => onEdit(prop)} className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Editar propiedad">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(prop)} disabled={deleteMutationPending} className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50" title="Eliminar propiedad">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {paidThisMonth ? (
            canReverse && (
              <button onClick={() => onUnmark(prop, thisMonthRecord)} disabled={unmarkingId === thisMonthRecord?.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-semibold disabled:opacity-60 transition-opacity">
                {unmarkingId === thisMonthRecord?.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Desmarcar
              </button>
            )
          ) : (
            canRecord && (
              <button onClick={() => onPay(prop)} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-colors">
                Registrar cobro
              </button>
            )
          )}
        </div>
      </div>

      {propPayments.slice(0, 3).map(pay => (
        <div key={pay.id} className="flex items-center justify-between mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
          <span>{pay.month}{pay.paid_by ? ` · ${pay.paid_by}` : ''}</span>
          <span className="text-income font-medium">{fmt(pay.amount)}</span>
        </div>
      ))}
    </div>
  );
}