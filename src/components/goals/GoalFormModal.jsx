import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCatalog } from '@/hooks/useCatalog';
import { useFamily } from '@/lib/FamilyContext';
import { X, Check } from 'lucide-react';

const ICONS = ['🎯', '🏠', '🚗', '✈️', '🎓', '💍', '🏖️', '💻', '📱', '🏋️', '🍕', '💰'];
const COLORS = ['#059669', '#7c3aed', '#2563eb', '#dc2626', '#d97706', '#db2777', '#0891b2', '#16a34a'];

export default function GoalFormModal({ goal, onClose, onSaved }) {
  const { familyId } = useFamily();
  const { categories } = useCatalog(familyId);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    target_amount: '',
    deadline: '',
    icon: '🎯',
    color: '#059669',
    category_id: '',
    manual_saved: 0,
    is_active: true,
  });

  useEffect(() => {
    if (goal) {
      setForm({
        name: goal.name || '',
        description: goal.description || '',
        target_amount: goal.target_amount || '',
        deadline: goal.deadline || '',
        icon: goal.icon || '🎯',
        color: goal.color || '#059669',
        category_id: goal.category_id || '',
        manual_saved: goal.manual_saved || 0,
        is_active: goal.is_active !== false,
      });
    }
  }, [goal]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name || !form.target_amount) return;
    setSaving(true);
    const data = {
      ...form,
      family_id: familyId,
      target_amount: parseFloat(form.target_amount),
      manual_saved: parseFloat(form.manual_saved) || 0,
    };
    if (goal?.id) {
      await base44.entities.Goal.update(goal.id, data);
    } else {
      await base44.entities.Goal.create(data);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50">
      <div className="w-full md:max-w-md bg-card rounded-t-3xl md:rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-bold text-foreground">{goal ? 'Editar meta' : 'Nueva meta'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Icon picker */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Ícono</p>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(ic => (
                <button key={ic} onClick={() => set('icon', ic)}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition-all
                    ${form.icon === ic ? 'border-primary bg-primary/10 scale-110' : 'border-border bg-muted'}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Color</p>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => set('color', c)}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`} />
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Nombre *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Ej: Fondo de emergencia"
              className="mt-1 w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Descripción</label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Opcional"
              className="mt-1 w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Target amount */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Monto objetivo *</label>
            <input type="number" min="0" value={form.target_amount} onChange={e => set('target_amount', e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Deadline */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Fecha límite</label>
            <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)}
              className="mt-1 w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Manual saved */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Monto ya ahorrado</label>
            <input type="number" min="0" value={form.manual_saved} onChange={e => set('manual_saved', e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Category link */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Vincular a categoría (opcional)</label>
            <p className="text-[11px] text-muted-foreground mb-1">Los ingresos de esa categoría contarán como progreso</p>
            <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Sin categoría vinculada</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex-shrink-0">
          <button onClick={handleSave} disabled={saving || !form.name || !form.target_amount}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold disabled:opacity-50">
            <Check className="w-4 h-4" />
            {saving ? 'Guardando…' : 'Guardar meta'}
          </button>
        </div>
      </div>
    </div>
  );
}