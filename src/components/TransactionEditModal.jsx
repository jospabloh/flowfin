import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useFamily } from '@/lib/FamilyContext';
import { X } from 'lucide-react';
import { createFocusTrap } from '@/lib/focusTrap';
import NativeSelect from '@/components/NativeSelect';

const REQUIRED_TYPES = ['Necesario', 'Gusto', 'Urgente', 'Inversión', 'Otro'];

export default function TransactionEditModal({ transaction, categories, subcategories, persons, paymentMethods, onClose, onSaved }) {
  const modalRef = useRef(null);
  const [form, setForm] = useState({
    date: transaction.date || '',
    type: transaction.type || 'expense',
    amount: transaction.amount || '',
    description: transaction.description || '',
    category_id: transaction.category_id || '',
    subcategory_id: transaction.subcategory_id || '',
    person_id: transaction.person_id || '',
    payment_method_id: transaction.payment_method_id || '',
    required_type: transaction.required_type || 'Necesario',
    has_invoice: transaction.has_invoice || false,
    notes: transaction.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { familyId } = useFamily();

  useEffect(() => {
    if (!modalRef.current) return;
    const cleanup = createFocusTrap(modalRef);
    return cleanup;
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Transaction.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['transactions', familyId] });
      const previous = queryClient.getQueryData(['transactions', familyId]);
      queryClient.setQueryData(['transactions', familyId], (old = []) =>
        old.map(t => t.id === id ? { ...t, ...data } : t)
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['transactions', familyId], ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
    },
  });

  const handleSave = () => {
    const data = { ...form, amount: parseFloat(form.amount) };
    updateMutation.mutate({ id: transaction.id, data });
    onSaved();
    onClose();
  };

  const filteredSubs = subcategories.filter(s => s.category_id === form.category_id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <h2 id="modal-title" className="text-base font-bold text-foreground">Editar movimiento</h2>
          <button onClick={onClose} aria-label="Cerrar modal" className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto overscroll-none hide-scrollbar max-h-[calc(90vh-80px)]" onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}>
          {/* Type */}
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            {[{ key: 'expense', label: '💸 Egreso' }, { key: 'income', label: '💰 Ingreso' }].map(t => (
              <button key={t.key} onClick={() => set('type', t.key)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all
                  ${form.type === t.key ? (t.key === 'expense' ? 'bg-expense text-white' : 'bg-income text-white') : 'text-muted-foreground'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Monto</label>
            <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Descripción</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Date */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fecha</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Category + Subcategory */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rubro</label>
              <NativeSelect
                value={form.category_id}
                onChange={e => { set('category_id', e.target.value); set('subcategory_id', ''); }}
                placeholder="— Rubro"
                options={categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">SubRubro</label>
              <NativeSelect
                value={form.subcategory_id}
                onChange={e => set('subcategory_id', e.target.value)}
                placeholder="— Sub"
                options={filteredSubs.map(s => ({ value: s.id, label: s.name }))}
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Person */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Persona</label>
            <NativeSelect
              value={form.person_id}
              onChange={e => set('person_id', e.target.value)}
              placeholder="— Persona"
              options={persons.map(p => ({ value: p.id, label: p.name }))}
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm"
            />
          </div>

          {/* Payment method */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Forma de pago</label>
            <NativeSelect
              value={form.payment_method_id}
              onChange={e => set('payment_method_id', e.target.value)}
              placeholder="— Forma"
              options={paymentMethods.map(m => ({ value: m.id, label: m.name }))}
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm"
            />
          </div>

          {/* Required type */}
          {form.type === 'expense' && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Clasificación</label>
              <NativeSelect
                value={form.required_type}
                onChange={e => set('required_type', e.target.value)}
                placeholder="Clasificación"
                options={REQUIRED_TYPES.map(r => ({ value: r, label: r }))}
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notas</label>
            <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Opcional"
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving || !form.amount}
            className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 disabled:opacity-50 transition-all touch-target">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}