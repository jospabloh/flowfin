import { useState } from 'react';
import { X, Calculator, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import CalculatorWidget from '@/components/CalculatorWidget';
import SearchableButtonSelect from '@/components/SearchableButtonSelect';
import { useFamily } from '@/lib/FamilyContext';

export default function InvestmentPayFormModal({
  show, title, form, setForm, onSave, onClose,
  investmentName, paymentNumber, totalPayments, error, isSaving,
  persons = [], categories = [], paymentMethods = [],
}) {
  const { currencySymbol } = useFamily();
  const [showCalculator, setShowCalculator] = useState(false);
  if (!show) return null;

  const expenseCategories = categories.filter(c => c.type !== 'income');
  // Persona/rubro are only required when this invocation actually renders them —
  // the "Editar Pago" call doesn't pass persons/categories (it only edits
  // amount/date/notes), so it must not be gated on fields it never shows.
  const personRequired = persons.length > 0;
  const categoryRequired = expenseCategories.length > 0;
  const canConfirm = !!form.amount
    && (!personRequired || !!form.person_id)
    && (!categoryRequired || !!form.category_id)
    && !isSaving;

  return createPortal(
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[300]"
            onClick={isSaving ? undefined : onClose}
          />

          {/* Bottom sheet — mismo patrón que el resto de la app */}
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            className="fixed bottom-0 left-0 right-0 z-[301] bg-card rounded-t-3xl border-t border-border flex flex-col"
            style={{ maxHeight: '90vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Handle */}
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3 flex-shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
              <h3 className="font-bold text-foreground text-base">{title}</h3>
              <button onClick={onClose} disabled={isSaving} className="p-2 rounded-xl bg-muted hover:bg-border transition-colors disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-3">
              {investmentName && paymentNumber && (
                <div className="px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl">
                  <p className="text-xs text-muted-foreground">Estás registrando:</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{investmentName}</p>
                  <p className="text-xs text-primary font-semibold">Cuota {paymentNumber}{totalPayments ? ` de ${totalPayments}` : ''}</p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive font-medium">{error}</p>
                </div>
              )}

              {/* Hero amount — same pattern as Capture: big display-face figure + calculator toggle */}
              <div className="rounded-2xl border-2 border-expense/30 bg-expense/5 p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">Monto *</p>
                  <button
                    type="button"
                    onClick={() => setShowCalculator(v => !v)}
                    className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg transition-colors ${showCalculator ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    Calc
                  </button>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-light text-muted-foreground">{currencySymbol}</span>
                  <input type="number" placeholder="0.00" inputMode="decimal" value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    className="flex-1 font-display text-4xl font-black tracking-tight nums-money bg-transparent border-none outline-none text-foreground placeholder-muted-foreground/30" />
                </div>
                {showCalculator && (
                  <CalculatorWidget
                    onCalculate={(result) => setForm(p => ({ ...p, amount: String(result) }))}
                    onClose={() => setShowCalculator(false)}
                  />
                )}
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fecha de pago *</label>
                <input type="date" value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  onClick={e => e.target.showPicker?.()}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 text-foreground cursor-pointer" />
              </div>

              {persons.length > 0 && (
                <SearchableButtonSelect
                  label="Persona *"
                  value={form.person_id}
                  onChange={e => setForm(p => ({ ...p, person_id: e.target.value }))}
                  options={persons.map(p => ({ id: p.id, label: p.name }))}
                  placeholder="Buscar persona..."
                />
              )}

              {expenseCategories.length > 0 && (
                <SearchableButtonSelect
                  label="Rubro *"
                  value={form.category_id}
                  onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                  options={expenseCategories.map(c => ({ id: c.id, label: c.name, icon: c.icon }))}
                  placeholder="Buscar rubro..."
                />
              )}

              {paymentMethods.length > 0 && (
                <SearchableButtonSelect
                  label="Forma de pago (opcional)"
                  value={form.payment_method_id}
                  onChange={e => setForm(p => ({ ...p, payment_method_id: e.target.value }))}
                  options={paymentMethods.map(m => ({ id: m.id, label: m.name }))}
                  placeholder="Buscar forma de pago..."
                />
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notas (opcional)</label>
                <input type="text" placeholder="Notas opcionales" value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 text-foreground" />
              </div>
            </div>

            {/* Footer siempre visible */}
            <div className="flex-shrink-0 px-5 pt-3 pb-6 border-t border-border">
              {!canConfirm && !isSaving && form.amount && ((personRequired && !form.person_id) || (categoryRequired && !form.category_id)) && (
                <p className="text-xs text-muted-foreground text-center mb-2">Selecciona persona y rubro para continuar</p>
              )}
              <div className="flex gap-2">
                <button onClick={onClose} disabled={isSaving}
                  className="flex-1 py-3 rounded-xl bg-muted text-foreground text-sm font-medium disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={onSave}
                  disabled={!canConfirm}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSaving ? 'Guardando...' : 'Confirmar pago'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
