import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InvestmentPayFormModal({
  show, title, form, setForm, onSave, onClose,
  investmentName, paymentNumber,
  persons = [], categories = [], paymentMethods = [],
}) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70]"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="fixed z-[71] bg-card rounded-2xl border border-border shadow-2xl flex flex-col"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 2rem)',
              maxWidth: '420px',
              maxHeight: '88vh',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
              <h3 className="font-bold text-foreground text-base">{title}</h3>
              <button onClick={onClose} className="p-2 rounded-xl bg-muted hover:bg-border transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-3">
              {investmentName && paymentNumber && (
                <div className="px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl">
                  <p className="text-xs text-muted-foreground">Estás registrando:</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{investmentName}</p>
                  <p className="text-xs text-primary font-semibold">Pago #{paymentNumber}</p>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Monto *</label>
                <input type="number" placeholder="0.00" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 text-foreground" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fecha de pago *</label>
                <input type="date" value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 text-foreground" />
              </div>

              {persons.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Persona *</label>
                  <select
                    value={form.person_id || ''}
                    onChange={e => setForm(p => ({ ...p, person_id: e.target.value }))}
                    className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none text-foreground focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— Selecciona persona</option>
                    {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {categories.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Rubro *</label>
                  <select
                    value={form.category_id || ''}
                    onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                    className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none text-foreground focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— Selecciona rubro</option>
                    {categories.filter(c => c.type !== 'income').map(c => (
                      <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {paymentMethods.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Forma de pago</label>
                  <select
                    value={form.payment_method_id || ''}
                    onChange={e => setForm(p => ({ ...p, payment_method_id: e.target.value }))}
                    className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none text-foreground focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— Selecciona (opcional)</option>
                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notas (opcional)</label>
                <input type="text" placeholder="Notas opcionales" value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 text-foreground" />
              </div>
            </div>

            {/* Footer — siempre visible */}
            <div className="flex-shrink-0 px-5 pt-3 pb-5">
              {(!form.person_id || !form.category_id) && form.amount && (
                <p className="text-xs text-muted-foreground text-center mb-2">* Selecciona persona y rubro para continuar</p>
              )}
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium">
                  Cancelar
                </button>
                <button
                  onClick={onSave}
                  disabled={!form.amount || !form.person_id || !form.category_id}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                >
                  Confirmar pago
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}