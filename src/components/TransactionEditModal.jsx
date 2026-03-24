import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';

const REQUIRED_TYPES = ['Necesario', 'Gusto', 'Urgente', 'Inversión', 'Otro'];

export default function TransactionEditModal({ transaction, categories, subcategories, persons, paymentMethods, onClose, onSaved }) {
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

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Transaction.update(transaction.id, {
      ...form,
      amount: parseFloat(form.amount),
    });
    onSaved();
    onClose();
  };

  const filteredSubs = subcategories.filter(s => s.category_id === form.category_id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Editar movimiento</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
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
              <select value={form.category_id} onChange={e => { set('category_id', e.target.value); set('subcategory_id', ''); }}
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none">
                <option value="">— Rubro</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">SubRubro</label>
              <select value={form.subcategory_id} onChange={e => set('subcategory_id', e.target.value)}
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none">
                <option value="">— Sub</option>
                {filteredSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Person */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Persona</label>
            <select value={form.person_id} onChange={e => set('person_id', e.target.value)}
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none">
              <option value="">— Persona</option>
              {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Payment method */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Forma de pago</label>
            <select value={form.payment_method_id} onChange={e => set('payment_method_id', e.target.value)}
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none">
              <option value="">— Forma</option>
              {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {/* Required type */}
          {form.type === 'expense' && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Clasificación</label>
              <select value={form.required_type} onChange={e => set('required_type', e.target.value)}
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none">
                {REQUIRED_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
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
            className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 disabled:opacity-50 transition-all">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}