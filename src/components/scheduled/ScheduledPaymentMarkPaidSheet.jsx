import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchableButtonSelect from '@/components/SearchableButtonSelect';
import { useBottomSheetStyle } from '@/hooks/useBottomSheetStyle';

export default function ScheduledPaymentMarkPaidSheet({ payingItem, payAmount, setPayAmount, payDate, setPayDate, payPersonId, setPayPersonId, payPaymentMethodId, setPayPaymentMethodId, payNotes, setPayNotes, isSaving, persons, paymentMethods, onConfirm, onClose }) {
  const sheetStyle = useBottomSheetStyle(0.90);

  return (
    <AnimatePresence>
      {payingItem && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50" onClick={() => { if (!isSaving) onClose(); }} />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border flex flex-col"
            style={sheetStyle}
          >
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3 flex-shrink-0" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
              <p className="text-sm font-bold text-foreground">Registrar pago: {payingItem.name}</p>
              <button onClick={() => { if (!isSaving) onClose(); }} className="p-1.5 rounded-lg bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 overscroll-none hide-scrollbar px-5 py-4 space-y-3"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Monto pagado</p>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  placeholder="0.00" inputMode="decimal"
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Fecha de pago</p>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                  onClick={e => e.target.showPicker?.()}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer" />
              </div>
              <SearchableButtonSelect value={payPersonId} onChange={e => setPayPersonId(e.target.value)}
                options={persons.map(p => ({ id: p.id, label: p.name }))} placeholder="Buscar persona..." label="¿Quién paga?" />
              <SearchableButtonSelect value={payPaymentMethodId} onChange={e => setPayPaymentMethodId(e.target.value)}
                options={paymentMethods.map(m => ({ id: m.id, label: m.name }))} placeholder="Buscar forma de pago..." label="Con qué se pagó" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notas (opcional)</p>
                <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)}
                  placeholder="Número de referencia, observaciones..."
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <button onClick={onConfirm} disabled={isSaving}
                className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-sm active:opacity-80 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[52px]">
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Confirmar pago'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}