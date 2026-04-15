import { X, Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import NativeSelect from '@/components/NativeSelect';
import { useBottomSheetStyle } from '@/hooks/useBottomSheetStyle';

export default function RentalPaymentSheet({ show, prop, payForm, setPayForm, persons, paymentMethods, isSaving, onConfirm, onClose }) {
  const sheetStyle = useBottomSheetStyle(0.90);
  if (!show || !prop) return null;

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => { if (!isSaving) onClose(); }} />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border flex flex-col"
            style={sheetStyle}
          >
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3 flex-shrink-0" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
              <p className="text-sm font-bold text-foreground">Registrar cobro: {prop.name}</p>
              <button onClick={() => { if (!isSaving) onClose(); }} className="p-1.5 rounded-lg bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 overscroll-none hide-scrollbar px-5 py-4 space-y-3"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Mes a cobrar</p>
                <input type="month" value={payForm.month} onChange={e => setPayForm(p => ({ ...p, month: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Monto cobrado</p>
                <input type="number" inputMode="decimal" placeholder={String(prop.base_rent || '')}
                  value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Fecha del cobro</p>
                <input type="date" value={payForm.date_paid} onChange={e => setPayForm(p => ({ ...p, date_paid: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">¿Quién recibió el pago?</p>
                <NativeSelect value={payForm.paid_by_id} onChange={e => setPayForm(p => ({ ...p, paid_by_id: e.target.value }))}
                  placeholder="Sin especificar"
                  options={[{ value: '', label: 'Sin especificar' }, ...persons.map(p => ({ value: p.id, label: p.name }))]}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Método de pago</p>
                <NativeSelect value={payForm.payment_method_id} onChange={e => setPayForm(p => ({ ...p, payment_method_id: e.target.value }))}
                  placeholder="Sin especificar"
                  options={[{ value: '', label: 'Sin especificar' }, ...paymentMethods.map(m => ({ value: m.id, label: m.name }))]}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notas (opcional)</p>
                <input placeholder="Referencia, observaciones..." value={payForm.notes}
                  onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <button onClick={onConfirm} disabled={isSaving || !payForm.amount}
                className="w-full py-3.5 bg-income text-white rounded-xl font-bold text-sm shadow-sm active:opacity-80 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[52px]">
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Check className="w-4 h-4" /> Confirmar cobro</>}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}