import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { useCatalog } from '@/hooks/useCatalog';
import PageHeader from '@/components/PageHeader';
import AmountDisplay from '@/components/AmountDisplay';
import { Plus, Pencil, Trash2, CheckCircle2, Circle, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import NativeSelect from '@/components/NativeSelect';

const ICONS = ['💰','💡','📱','🏠','🚗','🎓','🏥','💧','🌐','📺','🎮','🛒','✈️','💳','🏋️'];

const TODAY = new Date();
const CURRENT_MONTH = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`;

function statusColor(dueDay) {
  const today = TODAY.getDate();
  const diff = dueDay - today;
  if (diff < 0) return 'red';
  if (diff <= 3) return 'amber';
  return 'green';
}

export default function ScheduledPayments() {
  const { familyId, isAdmin, currentUser } = useFamily();
  const { categories, paymentMethods } = useCatalog(familyId);
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [payingItem, setPayingItem] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payDate, setPayDate] = useState(TODAY.toISOString().split('T')[0]);

  const { data: payments = [] } = useQuery({
    queryKey: ['scheduledPayments', familyId],
    queryFn: () => base44.entities.ScheduledPayment.filter({ family_id: familyId }),
    enabled: !!familyId,
  });

  const { data: records = [] } = useQuery({
    queryKey: ['scheduledPaymentRecords', familyId],
    queryFn: () => base44.entities.ScheduledPaymentRecord.filter({ family_id: familyId }),
    enabled: !!familyId,
  });

  // Which payments are already paid this month
  const paidThisMonth = useMemo(() =>
    new Set(records.filter(r => r.month === CURRENT_MONTH).map(r => r.scheduled_payment_id)),
    [records]
  );

  const pending = payments.filter(p => p.is_active !== false && !paidThisMonth.has(p.id));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ScheduledPayment.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledPayments', familyId] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScheduledPayment.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledPayments', familyId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduledPayment.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledPayments', familyId] }),
  });

  const markPaidMutation = useMutation({
    mutationFn: (data) => base44.entities.ScheduledPaymentRecord.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledPaymentRecords', familyId] }),
  });

  const unmarkPaidMutation = useMutation({
    mutationFn: async (scheduledPaymentId) => {
      const record = records.find(r => r.month === CURRENT_MONTH && r.scheduled_payment_id === scheduledPaymentId);
      if (record) await base44.entities.ScheduledPaymentRecord.delete(record.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledPaymentRecords', familyId] }),
  });

  const handleMarkPaid = () => {
    if (!payingItem) return;
    markPaidMutation.mutate({
      scheduled_payment_id: payingItem.id,
      family_id: familyId,
      month: CURRENT_MONTH,
      paid_date: payDate,
      amount_paid: parseFloat(payAmount) || payingItem.amount || 0,
      notes: payNotes,
      paid_by: currentUser?.full_name || currentUser?.email || 'Usuario',
    });
    setPayingItem(null);
    setPayAmount('');
    setPayNotes('');
    setPayDate(TODAY.toISOString().split('T')[0]);
  };

  const sorted = [...payments].sort((a, b) => (a.due_day || 0) - (b.due_day || 0));

  return (
    <div className="pb-8">
      <PageHeader
        title="Pagos Programados"
        subtitle={`${pending.length} pendiente${pending.length !== 1 ? 's' : ''} este mes`}
        action={isAdmin && (
          <button
            onClick={() => { setEditingItem(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        )}
      />

      <div className="px-4 space-y-3">
        {payments.length === 0 && (
          <div className="text-center py-12 bg-card border border-border rounded-2xl">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-sm font-semibold text-foreground">Sin pagos programados</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isAdmin ? 'Agrega los pagos recurrentes del mes.' : 'El administrador aún no ha agregado pagos.'}
            </p>
          </div>
        )}

        {sorted.map(item => {
          const isPaid = paidThisMonth.has(item.id);
          const cat = categories.find(c => c.id === item.category_id);
          const color = isPaid ? 'green' : (item.is_active === false ? 'gray' : statusColor(item.due_day));
          const record = records.find(r => r.month === CURRENT_MONTH && r.scheduled_payment_id === item.id);

          const colorMap = {
            green: 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800',
            amber: 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-700',
            red: 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800',
            gray: 'bg-muted/50 border-border',
          };

          const dotMap = {
            green: 'bg-green-500',
            amber: 'bg-amber-400',
            red: 'bg-red-500',
            gray: 'bg-muted-foreground/30',
          };

          return (
            <div key={item.id} className={`rounded-2xl border p-4 transition-all ${colorMap[color]}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{item.icon || '💰'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-bold ${item.is_active === false ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {item.name}
                    </p>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotMap[color]}`} />
                    {isPaid && <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">✓ Pagado</span>}
                    {!isPaid && item.is_active !== false && color === 'red' && (
                      <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">Vencido</span>
                    )}
                    {!isPaid && item.is_active !== false && color === 'amber' && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">Vence pronto</span>
                    )}
                    {item.is_active === false && (
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Inactivo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-xs text-muted-foreground">Día {item.due_day} de cada mes</p>
                    {cat && <span className="text-xs text-muted-foreground">· {cat.icon} {cat.name}</span>}
                    {item.amount > 0 && (
                      <span className="text-xs font-semibold text-foreground">
                        · <AmountDisplay amount={item.amount} type="expense" size="sm" showSign={false} />
                      </span>
                    )}
                  </div>
                  {isPaid && record && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Pagado el {record.paid_date} {record.paid_by ? `por ${record.paid_by}` : ''} {record.amount_paid ? `· $${record.amount_paid.toLocaleString()}` : ''}
                    </p>
                  )}
                  {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                {/* Mark paid / unpaid */}
                {item.is_active !== false && (
                  isPaid ? (
                    <button
                      onClick={() => unmarkPaidMutation.mutate(item.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors touch-target"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Desmarcar
                    </button>
                  ) : (
                    <button
                      onClick={() => { setPayingItem(item); setPayAmount(item.amount ? String(item.amount) : ''); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm active:scale-[0.98] transition-all touch-target"
                    >
                      <Circle className="w-3.5 h-3.5" /> Marcar como pagado
                    </button>
                  )
                )}

                {/* Admin actions */}
                {isAdmin && (
                  <>
                    <button
                      onClick={() => { setEditingItem(item); setShowForm(true); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors touch-target"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar "${item.name}"?`)) deleteMutation.mutate(item.id);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium hover:bg-expense/10 hover:text-expense transition-colors touch-target"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mark Paid Sheet */}
      <AnimatePresence>
        {payingItem && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50" onClick={() => setPayingItem(null)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border p-5"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)' }}
            >
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-foreground">Registrar pago: {payingItem.name}</p>
                <button onClick={() => setPayingItem(null)} className="p-1.5 rounded-lg bg-muted">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Monto pagado</p>
                  <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                    placeholder="0.00" inputMode="decimal"
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fecha de pago</p>
                  <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notas (opcional)</p>
                  <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)}
                    placeholder="Número de referencia, observaciones..."
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <button onClick={handleMarkPaid}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-sm active:scale-[0.98] transition-all">
                  Confirmar pago
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create/Edit Form Sheet */}
      <AnimatePresence>
        {showForm && (
          <ScheduledPaymentForm
            item={editingItem}
            familyId={familyId}
            categories={categories}
            paymentMethods={paymentMethods}
            onSave={(data) => {
              if (editingItem) {
                updateMutation.mutate({ id: editingItem.id, data });
              } else {
                createMutation.mutate({ ...data, family_id: familyId });
              }
              setShowForm(false);
              setEditingItem(null);
            }}
            onClose={() => { setShowForm(false); setEditingItem(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ScheduledPaymentForm({ item, familyId, categories, paymentMethods, onSave, onClose }) {
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
    onSave({
      name: name.trim(),
      description: description.trim(),
      amount: parseFloat(amount) || 0,
      due_day: parseInt(dueDay),
      category_id: categoryId || undefined,
      payment_method_id: paymentMethodId || undefined,
      icon,
      is_active: isActive,
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 16px)' }}
      >
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3 mb-0" />
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-sm font-bold text-foreground">{item ? 'Editar pago' : 'Nuevo pago programado'}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[70vh] px-5 py-4 space-y-3">
          {/* Icon picker */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Ícono</p>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setIcon(ic)}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all ${icon === ic ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted'}`}>
                  {ic}
                </button>
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
            <NativeSelect value={categoryId} onChange={e => setCategoryId(e.target.value)}
              placeholder="Sin categoría"
              options={[{ value: '', label: 'Sin categoría' }, ...categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))]}
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm" />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Forma de pago habitual</p>
            <NativeSelect value={paymentMethodId} onChange={e => setPaymentMethodId(e.target.value)}
              placeholder="Sin especificar"
              options={[{ value: '', label: 'Sin especificar' }, ...paymentMethods.map(m => ({ value: m.id, label: m.name }))]}
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm" />
          </div>

          {item && (
            <button onClick={() => setIsActive(!isActive)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all w-full justify-between
                ${isActive ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground bg-muted'}`}>
              <span>{isActive ? 'Pago activo' : 'Pago inactivo'}</span>
              <div className={`w-8 h-4 rounded-full transition-colors ${isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform mt-0.5 ${isActive ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          )}

          <button onClick={handleSubmit} disabled={!name.trim() || !dueDay}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-sm disabled:opacity-50 active:scale-[0.98] transition-all mt-2">
            {item ? 'Guardar cambios' : 'Crear pago programado'}
          </button>
        </div>
      </motion.div>
    </>
  );
}