import { X, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import ProgressBar from '@/components/ProgressBar';
import AmountDisplay from '@/components/AmountDisplay';
import { useBottomSheetStyle } from '@/hooks/useBottomSheetStyle';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency } from '@/lib/formatters';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';

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
              <ProgressBar value={selectedPayments.length} max={selected.total_payments} className="mb-3 h-3" />
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Pagos realizados</p>
                  <p className="text-xl font-bold text-foreground">{selectedPayments.length} <span className="text-sm font-normal text-muted-foreground">/ {selected.total_payments}</span></p>
                </div>
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Restantes</p>
                  <p className="text-xl font-bold text-foreground">{selected.total_payments - selectedPayments.length}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-income/10 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Monto total</p>
                  <p className="text-lg font-bold text-income">{fmtMXN(selected.total_amount)}</p>
                </div>
                <div className="bg-expense/10 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Monto pendiente</p>
                  <p className="text-lg font-bold text-expense">{fmtMXN(selected.total_amount - selectedPayments.reduce((s, p) => s + p.amount, 0))}</p>
                </div>
              </div>
              {nextPayment && (
                <div className={`rounded-xl p-3 mb-4 ${nextPayment.diff < 0 ? 'bg-expense/10' : nextPayment.diff <= 7 ? 'bg-yellow-500/10' : 'bg-income/10'}`}>
                  <p className="text-xs font-semibold text-foreground">Próximo pago #{nextPayment.number}</p>
                  <p className="text-sm text-muted-foreground">{format(nextPayment.date, "dd 'de' MMMM yyyy", { locale: es })}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{nextPayment.diff < 0 ? `¡${Math.abs(nextPayment.diff)} días vencido!` : nextPayment.diff === 0 ? '¡Hoy!' : `En ${nextPayment.diff} días`}</p>
                </div>
              )}
              <button onClick={onPay} className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm mb-4">Registrar Pago</button>
              <h4 className="text-sm font-semibold text-foreground mb-2">Historial de pagos</h4>
              <div className="space-y-2">
                {selectedPayments.length === 0 ? <p className="text-sm text-muted-foreground">Sin pagos registrados</p>
                  : selectedPayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex-1">
                        <p className="text-sm text-foreground">Pago #{p.payment_number}</p>
                        <p className="text-xs text-muted-foreground">{p.date}</p>
                      </div>
                      <div className="flex items-center gap-2">
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