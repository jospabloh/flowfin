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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[61] bg-card rounded-2xl border border-border p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">{title}</h3>
              <button onClick={onClose} className="p-2 rounded-xl bg-muted hover:bg-border transition-colors"><X className="w-4 h-4" /></button>
            </div>

            {/* Confirmation summary */}
            {investmentName && paymentNumber && (
              <div className="mb-4 px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl">
                <p className="text-xs text-muted-foreground">Estás registrando:</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{investmentName}</p>
                <p className="text-xs text-primary font-semibold">Pago #{paymentNumber}</p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Monto *</label>
                <input type="number" placeholder="0.00" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fecha de pago *</label>
                <input type="date" value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
              </div>

              {/* Persona */}
              {persons.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Persona *</label>
                  <select
                    value={form.person_id || ''}
                    onChange={e => setForm(p => ({ ...p, person_id: e.target.value }))}
                    className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none text-foreground"
                  >
                    <option value="">— Selecciona persona</option>
                    {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Rubro */}
              {categories.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Rubro *</label>
                  <select
                    value={form.category_id || ''}
                    onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                    className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none text-foreground"
                  >
                    <option value="">— Selecciona rubro</option>
                    {categories.filter(c => c.type !== 'income').map(c => (
                      <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Forma de pago */}
              {paymentMethods.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Forma de pago</label>
                  <select
                    value={form.payment_method_id || ''}
                    onChange={e => setForm(p => ({ ...p, payment_method_id: e.target.value }))}
                    className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none text-foreground"
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
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium">Cancelar</button>
              <button
                onClick={onSave}
                disabled={!form.amount || !form.person_id || !form.category_id}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                Confirmar pago
              </button>
            </div>
            {(!form.person_id || !form.category_id) && form.amount && (
              <p className="text-xs text-muted-foreground text-center mt-2">* Selecciona persona y rubro para continuar</p>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}