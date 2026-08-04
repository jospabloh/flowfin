import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { useCatalog } from '@/hooks/useCatalog';
import PageHeader from '@/components/PageHeader';
import { Plus, ChevronDown, CheckCircle2, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRegisterPaymentWithTransaction } from '@/hooks/useRegisterPaymentWithTransaction';
import { useToast } from '@/components/ui/use-toast';
import ScheduledPaymentItem from '@/components/scheduled/ScheduledPaymentItem';
import ScheduledPaymentMarkPaidSheet from '@/components/scheduled/ScheduledPaymentMarkPaidSheet';
import ScheduledPaymentForm from '@/components/scheduled/ScheduledPaymentForm';
import PauseUntilSheet from '@/components/scheduled/PauseUntilSheet';
import { todayISO } from '@/lib/formatters';
import { usePermission } from '@/lib/permissions/usePermission';

const TODAY = new Date();
const CURRENT_MONTH = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`;

function parsePausedUntil(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-31`; // month-level pause
  return value;
}

function isTemporarilyPaused(item) {
  if (!item?.paused_until) return false;
  const parsed = parsePausedUntil(item.paused_until);
  if (!parsed) return false;
  const pauseEnd = new Date(`${parsed}T23:59:59`);
  return !Number.isNaN(pauseEnd.getTime()) && TODAY <= pauseEnd;
}

export default function ScheduledPayments() {
  const { familyId, isAdmin, currentUser } = useFamily();
  const { categories, paymentMethods, persons } = useCatalog(familyId);
  const queryClient = useQueryClient();
  const registerPayment = useRegisterPaymentWithTransaction();
  const { toast } = useToast();
  const { can_write: canCreate }       = usePermission('scheduled.create.form');


  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [payingItem, setPayingItem] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payDate, setPayDate] = useState(todayISO());
  const [payPersonId, setPayPersonId] = useState('');
  const [payPaymentMethodId, setPayPaymentMethodId] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [unmarkingId, setUnmarkingId] = useState(null);
  const [activeView, setActiveView] = useState('active');
  const [showPaid, setShowPaid] = useState(false);
  const [pausingItem, setPausingItem] = useState(null);

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

  const monthRecords = useMemo(() => records.filter(r => r.month === CURRENT_MONTH), [records]);
  const paidThisMonth = useMemo(() => new Set(monthRecords.filter(r => ['posted', 'reconciled'].includes(r.status || 'reconciled')).map(r => r.scheduled_payment_id)), [monthRecords]);
  const skippedThisMonth = useMemo(() => new Set(monthRecords.filter(r => r.status === 'skipped').map(r => r.scheduled_payment_id)), [monthRecords]);
  const activePayments = useMemo(() => payments.filter(p => p.is_active !== false), [payments]);
  const archivedPayments = useMemo(() => payments.filter(p => p.is_active === false), [payments]);
  const automatedPayments = useMemo(() => activePayments.filter(p => p.automation_mode === 'auto'), [activePayments]);
  const pending = activePayments.filter(p => !isTemporarilyPaused(p) && !paidThisMonth.has(p.id) && !skippedThisMonth.has(p.id));
  const viewList = activeView === 'archived' ? archivedPayments : activeView === 'auto' ? automatedPayments : activePayments;
  const sorted = [...viewList].sort((a, b) => (a.due_day || 0) - (b.due_day || 0));
  const unpaidSorted = activeView === 'archived' ? sorted : sorted.filter(item => !paidThisMonth.has(item.id));
  const paidSorted = activeView === 'archived' ? [] : sorted.filter(item => paidThisMonth.has(item.id));

  // updateMutation covers pause/resume/edit — none of these had an onError
  // handler before, so a rejected write (schema mismatch, RLS, network) failed
  // completely silently: the button click just appeared to do nothing, which
  // is exactly what was happening to "Pausar 1 mes" (paused_until/pause_reason/
  // audit_events were never declared on the ScheduledPayment entity schema).
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ScheduledPayment.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledPayments', familyId] }),
    onError: (err) => toast({ title: 'Error al guardar', description: err?.message || 'No se pudo crear el pago programado.', variant: 'destructive' }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScheduledPayment.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledPayments', familyId] }),
    onError: (err) => toast({ title: 'Error al guardar', description: err?.message || 'No se pudo actualizar el pago programado.', variant: 'destructive' }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (item) => {
      const [linkedRecords, linkedTransactions] = await Promise.all([
        base44.entities.ScheduledPaymentRecord.filter({ family_id: familyId, scheduled_payment_id: item.id }),
        base44.entities.Transaction.filter({ family_id: familyId, scheduled_payment_id: item.id }),
      ]);
      if (linkedRecords.length > 0 || linkedTransactions.length > 0) {
        return base44.entities.ScheduledPayment.update(item.id, {
          is_active: false,
          archived_at: new Date().toISOString(),
          archived_by: currentUser?.full_name || currentUser?.email || 'Usuario',
        });
      }
      return base44.entities.ScheduledPayment.delete(item.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledPayments', familyId] }),
    onError: (err) => toast({ title: 'Error al eliminar', description: err?.message || 'No se pudo eliminar el pago programado.', variant: 'destructive' }),
  });

  const addAuditEvent = (item, action, reason) => ([
    ...(item.audit_events || []),
    {
      action,
      at: new Date().toISOString(),
      by: currentUser?.full_name || currentUser?.email || 'Usuario',
      by_user_id: currentUser?.id,
      reason: reason || undefined,
    },
  ]);

  // Opens PauseUntilSheet — replaces the old globalThis.prompt() flow (a bare
  // browser dialog with no validation) with a sheet consistent with the rest
  // of the app, offering both the "1 mes" quick option and a custom month.
  const handleConfirmPause = (pausedUntil, reason) => {
    if (!pausingItem) return;
    updateMutation.mutate({
      id: pausingItem.id,
      data: {
        paused_until: pausedUntil,
        pause_reason: reason,
        is_active: true,
        audit_events: addAuditEvent(pausingItem, 'pause', `${reason} — hasta ${pausedUntil}`),
      },
    });
    setPausingItem(null);
  };

  const handleResume = (item) => {
    updateMutation.mutate({
      id: item.id,
      data: {
        paused_until: undefined,
        pause_reason: undefined,
        is_active: true,
        audit_events: addAuditEvent(item, 'resume'),
      },
    });
  };

  const handleMarkPaid = async () => {
    if (!payingItem || isSavingPayment) return;
    const amount = parseFloat(payAmount) || payingItem.amount || 0;
    let primaryPersonId = payPersonId || payingItem.person_id || undefined;
    if (!primaryPersonId && persons.length > 0) primaryPersonId = persons[0].id;
    // registerPayment only creates the matching Transaction when category_id AND
    // person_id are present (same requirement enforced server-side by the
    // createTransactionFromScheduledPaymentRecord entity hook). Without this guard,
    // the ScheduledPaymentRecord still saves as "reconciled" and the item shows as
    // paid even though nothing was created in Movimientos — silently orphaning the
    // payment. Block here, before any write, instead of reporting false success.
    if (!payingItem.category_id || !primaryPersonId) {
      toast({
        title: 'Faltan datos para registrar el movimiento',
        description: `"${payingItem.name}" no tiene ${!payingItem.category_id ? 'categoría' : 'persona'} asignada. Edítalo y complétalo antes de marcarlo como pagado — si no, el pago quedaría marcado como pagado sin reflejarse en Movimientos.`,
        variant: 'destructive',
        duration: 7000,
      });
      return;
    }
    setIsSavingPayment(true);
    const selectedPerson = persons.find(p => p.id === primaryPersonId);
    const recordData = { scheduled_payment_id: payingItem.id, family_id: familyId, month: CURRENT_MONTH, paid_date: payDate, amount_paid: amount, notes: payNotes, paid_by: selectedPerson?.name || currentUser?.full_name || currentUser?.email || 'Usuario', status: 'reconciled', origin: 'manual' };
    try {
      await registerPayment(() => base44.entities.ScheduledPaymentRecord.create(recordData), {
        amount, date: payDate, description: `${payingItem.icon || ''} ${payingItem.name}${payNotes ? ` — ${payNotes}` : ''}`.trim(),
        category_id: payingItem.category_id || undefined, payment_method_id: payPaymentMethodId || payingItem.payment_method_id || undefined, person_id: primaryPersonId,
        scheduled_payment_id: payingItem.id,
      });
      queryClient.invalidateQueries({ queryKey: ['scheduledPaymentRecords', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });
      toast({ title: '✅ Pago registrado', description: `"${payingItem.name}" marcado como pagado.`, duration: 5000 });
      setPayingItem(null); setPayAmount(''); setPayNotes(''); setPayPersonId(''); setPayPaymentMethodId(''); setPayDate(todayISO());
    } catch (error) {
      toast({ title: 'Error al registrar pago', description: error?.message || 'Ocurrió un error. Intenta de nuevo.', variant: 'destructive', duration: 5000 });
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleUnmark = async (item) => {
    if (unmarkingId) return;
    setUnmarkingId(item.id);
    try {
      const freshRecords = await base44.entities.ScheduledPaymentRecord.filter({ family_id: familyId, scheduled_payment_id: item.id, month: CURRENT_MONTH });
      const record = freshRecords?.[0];
      if (record) {
        const linkedTxs = await base44.entities.Transaction.filter({ scheduled_payment_record_id: record.id });
        for (const tx of linkedTxs) await base44.entities.Transaction.delete(tx.id);
        await base44.entities.ScheduledPaymentRecord.delete(record.id);
        queryClient.invalidateQueries({ queryKey: ['scheduledPaymentRecords', familyId] });
        queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
        queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });
        toast({ title: '↩️ Pago desmarcado', description: `"${item.name}" desmarcado y egreso eliminado.`, duration: 5000 });
      } else {
        toast({ title: 'Sin registro', description: 'No se encontró el registro de pago para este mes.', variant: 'destructive', duration: 5000 });
      }
    } catch (error) {
      toast({ title: 'Error al desmarcar', description: error?.message || 'Ocurrió un error. Intenta de nuevo.', variant: 'destructive' });
    } finally {
      setUnmarkingId(null);
    }
  };

  return (
    <div className="pb-24">
      <PageHeader title="Pagos Programados" subtitle={`${pending.length} pendiente${pending.length !== 1 ? 's' : ''} este mes`}
        action={(isAdmin || canCreate) && (
          <button onClick={() => { setEditingItem(null); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        )} />

      <div className="px-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveView('active')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${activeView === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            Activos ({activePayments.length})
          </button>
          <button onClick={() => setActiveView('auto')} className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold ${activeView === 'auto' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            <Zap className="w-3 h-3" /> Automáticos ({automatedPayments.length})
          </button>
          <button onClick={() => setActiveView('archived')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${activeView === 'archived' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            Archivados ({archivedPayments.length})
          </button>
        </div>
        {sorted.length === 0 && (
          <div className="text-center py-12 bg-card border border-border rounded-2xl">
            <p className="text-3xl mb-2">{activeView === 'auto' ? '⚡' : '📅'}</p>
            <p className="text-sm font-semibold text-foreground">
              {activeView === 'archived' ? 'Sin pagos archivados' : activeView === 'auto' ? 'Sin domiciliados automáticos' : 'Sin pagos programados'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeView === 'archived'
                ? 'Los pagos archivados aparecerán aquí.'
                : activeView === 'auto'
                ? (isAdmin ? "Edita un pago y activa \"Domiciliado automático\" para que se registre solo." : 'El administrador aún no ha activado pagos automáticos.')
                : (isAdmin ? 'Agrega los pagos recurrentes del mes.' : 'El administrador aún no ha agregado pagos.')}
            </p>
          </div>
        )}
        {sorted.length > 0 && unpaidSorted.length === 0 && paidSorted.length > 0 && (
          <div className="text-center py-8 bg-card border border-border rounded-2xl">
            <CheckCircle2 className="w-7 h-7 text-green-500 mx-auto mb-1.5" />
            <p className="text-sm font-semibold text-foreground">¡Todo al día!</p>
            <p className="text-xs text-muted-foreground mt-1">Ya marcaste todos los pagos de este mes.</p>
          </div>
        )}
        {unpaidSorted.map(item => {
          const cat = categories.find(c => c.id === item.category_id);
          const record = monthRecords.find(r => r.scheduled_payment_id === item.id);
          return (
            <ScheduledPaymentItem key={item.id} item={item} isPaid={false} record={record} cat={cat}
              isUnmarking={unmarkingId === item.id} isAdmin={isAdmin}
              isPaused={isTemporarilyPaused(item)}
              onMarkPaid={(item) => { setPayingItem(item); setPayAmount(item.amount ? String(item.amount) : ''); setPayPaymentMethodId(item.payment_method_id || ''); setPayPersonId(persons[0]?.id || ''); }}
              onUnmark={handleUnmark} onEdit={(item) => { setEditingItem(item); setShowForm(true); }}
              onPauseUntil={setPausingItem}
              onResume={handleResume}
              onDelete={(selectedItem) => deleteMutation.mutate(selectedItem)} />
          );
        })}

        {paidSorted.length > 0 && (
          <div className="pt-1">
            <button onClick={() => setShowPaid(v => !v)} aria-expanded={showPaid}
              className="w-full flex items-center justify-between px-1 py-2 group/ph">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground/70 group-hover/ph:text-muted-foreground transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                Pagados este mes ({paidSorted.length})
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200 ${showPaid ? '' : '-rotate-90'}`} aria-hidden="true" />
            </button>
            <AnimatePresence initial={false}>
              {showPaid && (
                <motion.div key="paid-items" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: 'easeInOut' }} className="overflow-hidden">
                  <div className="space-y-3 pt-2">
                    {paidSorted.map(item => {
                      const cat = categories.find(c => c.id === item.category_id);
                      const record = monthRecords.find(r => r.scheduled_payment_id === item.id);
                      return (
                        <ScheduledPaymentItem key={item.id} item={item} isPaid record={record} cat={cat}
                          isUnmarking={unmarkingId === item.id} isAdmin={isAdmin}
                          isPaused={isTemporarilyPaused(item)}
                          onMarkPaid={(item) => { setPayingItem(item); setPayAmount(item.amount ? String(item.amount) : ''); setPayPaymentMethodId(item.payment_method_id || ''); setPayPersonId(persons[0]?.id || ''); }}
                          onUnmark={handleUnmark} onEdit={(item) => { setEditingItem(item); setShowForm(true); }}
                          onPauseUntil={setPausingItem}
                          onResume={handleResume}
                          onDelete={(selectedItem) => deleteMutation.mutate(selectedItem)} />
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ScheduledPaymentMarkPaidSheet payingItem={payingItem} payAmount={payAmount} setPayAmount={setPayAmount}
        payDate={payDate} setPayDate={setPayDate} payPersonId={payPersonId} setPayPersonId={setPayPersonId}
        payPaymentMethodId={payPaymentMethodId} setPayPaymentMethodId={setPayPaymentMethodId}
        payNotes={payNotes} setPayNotes={setPayNotes} isSaving={isSavingPayment}
        persons={persons} paymentMethods={paymentMethods} onConfirm={handleMarkPaid} onClose={() => setPayingItem(null)} />

      <PauseUntilSheet item={pausingItem} onConfirm={handleConfirmPause} onClose={() => setPausingItem(null)} />

      <AnimatePresence>
        {showForm && (
          <ScheduledPaymentForm item={editingItem} familyId={familyId} categories={categories} paymentMethods={paymentMethods}
            onSave={(data) => { if (editingItem) { updateMutation.mutate({ id: editingItem.id, data }); } else { createMutation.mutate({ ...data, family_id: familyId }); } setShowForm(false); setEditingItem(null); }}
            onClose={() => { setShowForm(false); setEditingItem(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
