import { X, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMonths, parseISO, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import AmountDisplay from '@/components/AmountDisplay';
import StatusBadge from '@/components/StatusBadge';
import InvestmentTimeline from '@/components/investments/InvestmentTimeline';
import { useBottomSheetStyle } from '@/hooks/useBottomSheetStyle';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency } from '@/lib/formatters';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm.jsx';

function relativeDay(dateStr) {
  const days = differenceInCalendarDays(new Date(), parseISO(dateStr));
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days}d`;
  return format(parseISO(dateStr), "dd 'de' MMM", { locale: es });
}

function getNextPayment(inv, paymentsMade) {
  const n = paymentsMade.length;
  if (n >= inv.total_payments) return null;
  const base = parseISO(inv.start_date);
  const next = addMonths(base, n);
  if (inv.payment_day) next.setDate(Math.min(inv.payment_day, 28));
  const diff = Math.ceil((next - new Date()) / 86400000);
  return { number: n + 1, date: next, diff };
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);

export default function InvestmentDetailSheet({ selected, allPayments, onClose, onPay, onEditPayment, onDeletePayment }) {
  const { currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const fmtMXN = v => formatCurrency(v, { locale, currency });
  const sheetStyle = useBottomSheetStyle(0.90);
  const { confirmDelete, ConfirmDialog } = useDeleteConfirm();
  if (!selected) return null;

  const handleDeletePay = async (id) => {
    if (await confirmDelete('¿Eliminar este pago?')) onDeletePayment(id);
  };

  const selectedPayments = allPayments.filter(p => p.investment_id === selected.id && (!p.date || p.date <= TODAY_ISO));
  const nextPayment = getNextPayment(selected, selectedPayments);

  return (
    <AnimatePresence>
      {selected && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border overflow-y-auto" style={sheetStyle}>
            <ConfirmDialog />
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground text-base">{selected.name}</h3>
              <button onClick={onClose} className="p-2 rounded-xl bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4">
              {/* Hero: paid vs pending, the two figures that matter most */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-income/10 rounded-2xl p-3.5">
                  <p className="text-xs text-muted-foreground mb-0.5">Pagado</p>
                  <AmountDisplay amount={selectedPayments.reduce((s, p) => s + p.amount, 0)} type="income" size="lg" showSign={false} />
                </div>
                <div className="bg-expense/10 rounded-2xl p-3.5">
                  <p className="text-xs text-muted-foreground mb-0.5">Pendiente</p>
                  <AmountDisplay amount={selected.total_amount - selectedPayments.reduce((s, p) => s + p.amount, 0)} type="expense" size="lg" showSign={false} />
                </div>
              </div>

              {/* Cuota timeline — the same signature strip as the card, full-size and tappable */}
              <div className="mb-4">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedPayments.length} <span className="font-normal text-muted-foreground">de {selected.total_payments} cuotas</span>
                  </p>
                  {selectedPayments.length >= selected.total_payments && <StatusBadge variant="success">Completado</StatusBadge>}
                </div>
                <InvestmentTimeline
                  total={selected.total_payments}
                  paidCount={selectedPayments.length}
                  overdue={!!nextPayment && nextPayment.diff < 0}
                  onNextClick={nextPayment ? onPay : undefined}
                />
              </div>

              {nextPayment && (
                <div className={`rounded-2xl p-3.5 mb-4 border ${nextPayment.diff < 0 ? 'bg-expense/10 border-expense/20' : nextPayment.diff <= 7 ? 'bg-warning/10 border-warning/20' : 'bg-muted border-border'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">Próxima cuota #{nextPayment.number}</p>
                    <StatusBadge variant={nextPayment.diff < 0 ? 'danger' : nextPayment.diff <= 7 ? 'warning' : 'neutral'}>
                      {nextPayment.diff < 0 ? `Vencida hace ${Math.abs(nextPayment.diff)}d` : nextPayment.diff === 0 ? 'Hoy' : `En ${nextPayment.diff}d`}
                    </StatusBadge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{format(nextPayment.date, "dd 'de' MMMM yyyy", { locale: es })}</p>
                </div>
              )}

              {nextPayment && (
                <button onClick={onPay} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm mb-5 shadow-sm active:opacity-80 transition-opacity">
                  Registrar cuota #{nextPayment.number}
                </button>
              )}

              <h4 className="text-sm font-semibold text-foreground mb-2">Historial de pagos</h4>
              <div className="space-y-1">
                {selectedPayments.length === 0 ? <p className="text-sm text-muted-foreground py-2">Sin pagos registrados todavía</p>
                  : [...selectedPayments].reverse().map(p => (
                    <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium">Cuota #{p.payment_number}</p>
                        <p className="text-xs text-muted-foreground">{relativeDay(p.date)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <AmountDisplay amount={p.amount} type="expense" size="sm" showSign={false} />
                        <button onClick={() => onEditPayment(p)} aria-label="Editar pago" className="p-1.5 min-h-[44px] min-w-[44px] hover:bg-muted rounded-lg transition-colors flex items-center justify-center">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDeletePay(p.id)} aria-label="Eliminar pago" className="p-1.5 min-h-[44px] min-w-[44px] hover:bg-destructive/10 rounded-lg transition-colors flex items-center justify-center">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}