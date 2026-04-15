import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomSheetStyle } from '@/hooks/useBottomSheetStyle';

export default function InvestmentFormSheet({ show, form, setForm, onCreate, onClose }) {
  const sheetStyle = useBottomSheetStyle(0.90);

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-[61] bg-card rounded-t-3xl border-t border-border p-5"
            style={{ ...sheetStyle, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Nueva Inversión</h3>
              <button onClick={onClose} className="p-2 rounded-xl bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Nombre (ej: LOCAL 03 ST. ANGELO)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
              <input placeholder="Tipo (inmueble, fondo, etc.)" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Monto total" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <input type="number" placeholder="# pagos" value={form.total_payments} onChange={e => setForm(f => ({ ...f, total_payments: e.target.value }))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="$ por pago" value={form.payment_amount} onChange={e => setForm(f => ({ ...f, payment_amount: e.target.value }))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <input type="number" placeholder="Día de pago (1-28)" value={form.payment_day} onChange={e => setForm(f => ({ ...f, payment_day: e.target.value }))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
              </div>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
            </div>
            <button onClick={onCreate} className="w-full mt-4 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm">Crear Inversión</button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}