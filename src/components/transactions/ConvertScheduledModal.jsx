/**
 * ConvertScheduledModal.jsx
 * Convert an existing Transaction into a recurring "domiciliado" ScheduledPayment.
 * Pre-fills fields from the source transaction. Defaults to manual mode.
 *
 * To avoid duplicating the movement: by default the source transaction is treated as
 * the payment for its own month — a reconciled ScheduledPaymentRecord is created and
 * the existing transaction is linked to it. The recurring payment then starts next month.
 */
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { useToast } from '@/components/ui/use-toast';
import { todayISO } from '@/lib/formatters';
import { X, CalendarCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ICON_PRESETS = ['💰', '💡', '📱', '🏠', '🚗', '🎓', '💳', '🌐', '📺', '🏥'];

function monthLabel(ym) {
  const [y, m] = (ym || '').split('-').map(Number);
  if (!y || !m) return '';
  return new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

export default function ConvertScheduledModal({ transaction, categories = [], paymentMethods = [], persons = [], onClose, onCreated }) {
  const { familyId, currentUser } = useFamily();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Initial day from transaction date, capped 1-28
  const initialDay = useMemo(() => {
    if (!transaction?.date) return 1;
    const d = Number(transaction.date.slice(8, 10) || 1);
    return Math.min(28, Math.max(1, d));
  }, [transaction]);

  // Month (YYYY-MM) of the source transaction — that's the month it already paid for.
  const txMonth = useMemo(() => (transaction?.date ? transaction.date.slice(0, 7) : ''), [transaction]);
  const canMarkPaid = !!transaction?.id && !!txMonth;

  const [form, setForm] = useState({
    name: transaction?.description || '',
    description: '',
    amount: transaction?.amount || 0,
    due_day: initialDay,
    type: transaction?.type || 'expense',
    category_id: transaction?.category_id || '',
    payment_method_id: transaction?.payment_method_id || '',
    person_id: transaction?.person_id || '',
    icon: '💰',
    automation_mode: 'manual', // safe default
    autopost_enabled: false,
    autopost_day_tolerance: 0,
  });
  // Treat the existing movement as the payment for its month (avoids a duplicate movement).
  const [markCurrentPaid, setMarkCurrentPaid] = useState(canMarkPaid);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const filteredCats = useMemo(
    () => (categories || []).filter((c) => c.type === 'both' || c.type === form.type),
    [categories, form.type]
  );

  const canSave = form.name.trim() && form.amount > 0 && form.due_day >= 1 && form.due_day <= 28 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const scheduledPayment = await base44.entities.ScheduledPayment.create({
        family_id: familyId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        amount: Number(form.amount),
        due_day: Number(form.due_day),
        type: form.type,
        category_id: form.category_id || undefined,
        payment_method_id: form.payment_method_id || undefined,
        person_id: form.person_id || undefined,
        icon: form.icon,
        is_active: true,
        automation_mode: form.automation_mode,
        autopost_enabled: form.automation_mode === 'auto' ? !!form.autopost_enabled : false,
        autopost_day_tolerance: Number(form.autopost_day_tolerance || 0),
      });

      let linkedThisMonth = false;
      if (markCurrentPaid && canMarkPaid && scheduledPayment?.id) {
        const selectedPerson = (persons || []).find((p) => p.id === form.person_id);
        const record = await base44.entities.ScheduledPaymentRecord.create({
          scheduled_payment_id: scheduledPayment.id,
          family_id: familyId,
          month: txMonth,
          paid_date: transaction.date || todayISO(),
          amount_paid: Number(transaction.amount) || Number(form.amount) || 0,
          notes: 'Pago inicial: movimiento existente al convertir en domiciliado',
          paid_by: selectedPerson?.name || currentUser?.full_name || currentUser?.email || 'Usuario',
          status: 'reconciled',
          origin: 'converted',
          linked_transaction_id: transaction.id,
        });
        await base44.entities.Transaction.update(transaction.id, {
          scheduled_payment_id: scheduledPayment.id,
          scheduled_payment_record_id: record.id,
          status: 'reconciled',
        });
        linkedThisMonth = true;
      }

      queryClient.invalidateQueries({ queryKey: ['scheduledPayments', familyId] });
      queryClient.invalidateQueries({ queryKey: ['scheduledPaymentRecords', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });

      toast({
        title: '✅ Domiciliado creado',
        description: linkedThisMonth
          ? `${form.name}: este movimiento quedó como el pago de ${monthLabel(txMonth)}. El domiciliado se registrará el próximo mes.`
          : `${form.name} se registró como movimiento recurrente.`,
      });
      onCreated?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: err?.message || 'No se pudo crear el domiciliado', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card w-full md:max-w-md rounded-t-3xl md:rounded-3xl max-h-[92vh] overflow-y-auto border border-border"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border z-10 flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center flex-shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-foreground text-sm leading-tight">Convertir en domiciliado</h3>
                <p className="text-[11px] text-muted-foreground truncate">Crear movimiento recurrente</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground touch-target">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <div className="p-5 space-y-4">
            {/* Name */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Nombre</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Ej: Luz CFE, Netflix, Colegiatura"
                className="w-full bg-muted text-foreground rounded-xl px-3 py-2.5 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Amount + Due day */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Monto</label>
                <input
                  type="number" step="0.01" min="0"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  className="w-full bg-muted text-foreground rounded-xl px-3 py-2.5 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Día del mes (1-28)</label>
                <input
                  type="number" min="1" max="28"
                  value={form.due_day}
                  onChange={(e) => set('due_day', Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-full bg-muted text-foreground rounded-xl px-3 py-2.5 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => set('type', 'expense')}
                  className={`py-2 rounded-xl text-xs font-semibold transition-colors ${form.type === 'expense' ? 'bg-expense/10 text-expense ring-1 ring-expense/40' : 'bg-muted text-muted-foreground'}`}
                >
                  Egreso (Pago)
                </button>
                <button
                  type="button"
                  onClick={() => set('type', 'income')}
                  className={`py-2 rounded-xl text-xs font-semibold transition-colors ${form.type === 'income' ? 'bg-income/10 text-income ring-1 ring-income/40' : 'bg-muted text-muted-foreground'}`}
                >
                  Ingreso (Cobro)
                </button>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Categoría</label>
              <select
                value={form.category_id}
                onChange={(e) => set('category_id', e.target.value)}
                className="w-full bg-muted text-foreground rounded-xl px-3 py-2.5 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Sin categoría</option>
                {filteredCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                ))}
              </select>
            </div>

            {/* Payment method */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Forma de pago</label>
              <select
                value={form.payment_method_id}
                onChange={(e) => set('payment_method_id', e.target.value)}
                className="w-full bg-muted text-foreground rounded-xl px-3 py-2.5 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Sin asignar</option>
                {(paymentMethods || []).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Person */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Persona responsable</label>
              <select
                value={form.person_id}
                onChange={(e) => set('person_id', e.target.value)}
                className="w-full bg-muted text-foreground rounded-xl px-3 py-2.5 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Sin asignar</option>
                {(persons || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Icon */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Icono</label>
              <div className="flex gap-1.5 flex-wrap">
                {ICON_PRESETS.map((ic) => (
                  <button key={ic} type="button" onClick={() => set('icon', ic)}
                    className={`w-9 h-9 rounded-xl text-lg transition-all ${form.icon === ic ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted hover:bg-accent'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Mark current month as already paid via the existing movement */}
            {canMarkPaid && (
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <button
                  type="button"
                  onClick={() => setMarkCurrentPaid((v) => !v)}
                  className="flex items-center justify-between w-full gap-3 min-h-[44px]"
                >
                  <span className="text-xs font-semibold text-foreground text-left">
                    Este movimiento ya es el pago de {monthLabel(txMonth)}
                  </span>
                  <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${markCurrentPaid ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mt-0.5 ${markCurrentPaid ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {markCurrentPaid
                    ? 'No se creará un segundo movimiento: este gasto cuenta como el pago de este mes y el domiciliado quedará listo para el próximo.'
                    : 'Se creará el domiciliado, pero tendrás que registrar el pago de este mes por separado (puede duplicar el movimiento).'}
                </p>
              </div>
            )}

            {/* Automation mode */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">¿Cómo se registrará cada mes?</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { set('automation_mode', 'manual'); set('autopost_enabled', false); }}
                  className={`py-2 rounded-xl text-xs font-semibold transition-colors ${form.automation_mode === 'manual' ? 'bg-primary/10 text-primary ring-1 ring-primary/40' : 'bg-muted text-muted-foreground'}`}>
                  Manual
                </button>
                <button type="button" onClick={() => { set('automation_mode', 'auto'); set('autopost_enabled', true); }}
                  className={`py-2 rounded-xl text-xs font-semibold transition-colors ${form.automation_mode === 'auto' ? 'bg-secondary/10 text-secondary ring-1 ring-secondary/40' : 'bg-muted text-muted-foreground'}`}>
                  Automático
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {form.automation_mode === 'auto'
                  ? '⚙️ El sistema lo registrará automáticamente cerca del día de vencimiento. Recibirás un correo diario con el resumen.'
                  : 'Tendrás que marcarlo como pagado cada mes desde "Pagos del Mes".'}
              </p>
            </div>

            {form.automation_mode === 'auto' && (
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Tolerancia (días antes)</label>
                <input
                  type="number" min="0" max="3"
                  value={form.autopost_day_tolerance}
                  onChange={(e) => set('autopost_day_tolerance', Math.min(3, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-full bg-muted text-foreground rounded-xl px-3 py-2.5 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 bg-card/95 backdrop-blur-md border-t border-border p-4 flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-accent transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!canSave}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
              {saving ? 'Guardando…' : 'Crear domiciliado'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
