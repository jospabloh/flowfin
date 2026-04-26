import { AlertTriangle, ChevronDown, ChevronUp, Pencil, Trash2, Link as LinkIcon } from 'lucide-react';
import AmountDisplay from '@/components/AmountDisplay';
import PersonAvatar from '@/components/PersonAvatar';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/formatters';
import { usePermission } from '@/lib/permissions/usePermission';

const getPaymentLinkInfo = (t) => {
  if (t.msi_payment_id) return { type: 'MSI', icon: '💳' };
  if (t.investment_payment_id) return { type: 'Inv', icon: '💰' };
  if (t.scheduled_payment_record_id) return { type: 'Prog', icon: '📅' };
  if (t.rental_payment_id) return { type: 'Renta', icon: '🏠' };
  return null;
};

export default function TransactionGroup({ date, txns, expanded, setExpanded, categories, subcategories, persons, paymentMethods, currency, locale, onEdit, onDelete }) {
  const { can_modify: canEdit } = usePermission('transaction.edit.details');
  const { can_delete: canDelete } = usePermission('transaction.delete.action');

  return (
    <div className="px-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {date !== 'Sin fecha' ? format(parseISO(date), "EEEE d 'de' MMMM", { locale: es }).replace(/^\w/, c => c.toUpperCase()) : 'Sin fecha'}
        </span>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">
          {formatCurrency(txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), { locale, currency })}
        </span>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {txns.map((t, idx) => {
          const cat = categories.find(c => c.id === t.category_id);
          const sub = subcategories.find(s => s.id === t.subcategory_id);
          const person = persons.find(p => p.id === t.person_id);
          const isExp = expanded === t.id;
          const linkInfo = getPaymentLinkInfo(t);
          const desc = t.description && t.notes ? `${t.description} — ${t.notes}` : t.description || t.notes || cat?.name || 'Sin descripción';

          return (
            <div key={t.id} className={idx < txns.length - 1 ? 'border-b border-border' : ''}>
              {(!t.person_id || !t.category_id) && (
                <div className="flex items-center gap-1.5 px-4 pt-2 pb-0">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    Pendiente — falta {!t.category_id && !t.person_id ? 'categoría y persona' : !t.category_id ? 'categoría' : 'persona'}
                  </span>
                </div>
              )}
              <button onClick={() => setExpanded(isExp ? null : t.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left">
                <div className="w-2 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color || '#94a3b8' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{desc}</p>
                    <AmountDisplay amount={t.amount} type={t.type} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {sub && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{sub.name}</span>}
                    {person && <PersonAvatar person={person} size="xs" />}
                    {t.required_type && t.required_type !== 'Necesario' && (
                      <span className="text-[10px] text-muted-foreground">{t.required_type}</span>
                    )}
                    {linkInfo && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <LinkIcon className="w-2.5 h-2.5" />{linkInfo.icon} {linkInfo.type}
                      </span>
                    )}
                  </div>
                </div>
                {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              </button>
              {isExp && (
                <div className="px-4 pb-3 bg-muted/30 border-t border-border">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs py-2">
                    {cat && <><span className="text-muted-foreground">Rubro</span><span className="text-foreground">{cat.icon} {cat.name}</span></>}
                    {person && <><span className="text-muted-foreground">Quien</span><span className="text-foreground">{person.name}</span></>}
                    {t.payment_method_id && <><span className="text-muted-foreground">Forma</span><span className="text-foreground">{paymentMethods.find(m => m.id === t.payment_method_id)?.name || '—'}</span></>}
                    {t.required_type && <><span className="text-muted-foreground">Requerido</span><span className="text-foreground">{t.required_type}</span></>}
                    {t.has_invoice && <><span className="text-muted-foreground">Factura</span><span className="text-primary font-medium">Sí</span></>}
                    {t.notes && <><span className="text-muted-foreground">Notas</span><span className="text-foreground">{t.notes}</span></>}
                  </div>
                  <div className="flex gap-2 mt-1">
                    {canEdit && (
                      <button onClick={() => onEdit(t)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors touch-target">
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => onDelete(t.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-expense/10 text-expense text-xs font-medium hover:bg-expense/20 transition-colors touch-target">
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}