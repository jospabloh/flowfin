import { useState } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useBottomSheetStyle } from '@/hooks/useBottomSheetStyle';
import NativeSelect from '@/components/NativeSelect';

const ICONS = ['💰','💡','📱','🏠','🚗','🎓','🏥','💧','🌐','📺','🎮','🛒','✈️','💳','🏋️'];

export default function ScheduledPaymentForm({ item, familyId: _familyId, categories, paymentMethods, onSave, onClose }) {
  const sheetStyle = useBottomSheetStyle(0.90);
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [amount, setAmount] = useState(item?.amount ? String(item.amount) : '');
  const [dueDay, setDueDay] = useState(item?.due_day ? String(item.due_day) : '');
  const [categoryId, setCategoryId] = useState(item?.category_id || '');
  const [paymentMethodId, setPaymentMethodId] = useState(item?.payment_method_id || '');
  const [icon, setIcon] = useState(item?.icon || '💰');
  const [isActive, setIsActive] = useState(item?.is_active !== false);

  const handleSubmit = () => {
    if (!name.trim() || !dueDay) return;
    onSave({ name: name.trim(), description: description.trim(), amount: parseFloat(amount) || 0, due_day: parseInt(dueDay), category_id: categoryId || undefined, payment_method_id: paymentMethodId || undefined, icon, is_active: isActive });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border flex flex-col" style={sheetStyle}>
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3 flex-shrink-0" />
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <p className="text-sm font-bold text-foreground">{item ? 'Editar pago' : 'Nuevo pago programado'}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 overscroll-none hide-scrollbar px-5 py-4 space-y-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Ícono</p>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setIcon(ic)} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${icon === ic ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted'}`}>{ic}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Nombre *</p>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Teléfono, Luz, Colegiatura"
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Descripción</p>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalles adicionales"
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Monto estimado</p>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal"
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Día de vencimiento *</p>
              <input type="number" value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="1–28" min="1" max="28"
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Categoría</p>
            <NativeSelect value={categoryId} onChange={e => setCategoryId(e.target.value)} placeholder="Sin categoría"
              options={[{ value: '', label: 'Sin categoría' }, ...categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))]}
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Forma de pago habitual</p>
            <NativeSelect value={paymentMethodId} onChange={e => setPaymentMethodId(e.target.value)} placeholder="Sin especificar"
              options={[{ value: '', label: 'Sin especificar' }, ...paymentMethods.map(m => ({ value: m.id, label: m.name }))]}
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm" />
          </div>
          {item && (
            <button onClick={() => setIsActive(!isActive)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all w-full justify-between min-h-[44px] ${isActive ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground bg-muted'}`}>
              <span>{isActive ? 'Pago activo' : 'Pago inactivo'}</span>
              <div className={`w-8 h-4 rounded-full transition-colors ${isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform mt-0.5 ${isActive ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          )}
          <button onClick={handleSubmit} disabled={!name.trim() || !dueDay}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-sm disabled:opacity-50 active:opacity-80 transition-opacity mt-2 min-h-[52px]">
            {item ? 'Guardar cambios' : 'Crear pago programado'}
          </button>
        </div>
      </motion.div>
    </>
  );
}
