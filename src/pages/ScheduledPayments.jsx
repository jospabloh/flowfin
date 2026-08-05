import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { useCatalog } from '@/hooks/useCatalog';
import PageHeader from '@/components/PageHeader';
import { Plus, CheckCircle2, Zap, PauseCircle, Hand } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
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

// Activos / Pausados / Archivados are the three lifecycle states — mutually
// exclusive, exactly one tab owns any given item. "Pendientes / Pagados este
// mes / Automáticos / Manuales" are a second, independent filter that only
// slices the Activos list — an automatic payment is still "Activos" whether
// it's paid or pending this month, so that's a filter, not a fourth state.
function getEmptyState({ activeView, activeFilter, isAdmin }) {
  if (activeView === 'archived') {
    return { icon: '📅', title: 'Sin pagos archivados', subtitle: 'Los pagos archivados aparecerán aquí.' };
  }
  if (activeView === 'paused') {
    return { icon: '⏸️', title: 'Nada pausado', subtitle: 'Los pagos que pauses aparecen acá mientras dure la pausa.' };
  }
  if (activeFilter === 'paid') {
    return { icon: '✅', title: 'Nada pagado todavía', subtitle: 'Los pagos que marques como pagados este mes van a aparecer acá.' };
  }
  if (activeFilter === 'auto') {
    return {
      icon: '⚡', title: 'Sin domiciliados automáticos',
      subtitle: isAdmin ? 'Edita un pago y activa "Domiciliado automático" para que se registre solo.' : 'El administrador aún no ha activado pagos automáticos.',
    };
  }
  if (activeFilter === 'manual') {
    return { icon: '✋', title: 'Sin pagos manuales', subtitle: 'Todos tus pagos activos son domiciliados automáticos.' };
  }
  return {
    icon: '📅', title: 'Sin pagos programados',
    subtitle: isAdmin ? 'Agrega los pagos recurrentes del mes.' : 'El administrador aún no ha agregado pagos.',
  };
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
  const [activeView, setActiveView] = useState('active'); // 'active' | 'paused' | 'archived'
  const [activeFilter, setActiveFilter] = useState('pending'); // 'pending' | 'paid' | 'auto' | 'manual' — only applies within Activos
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
  // Every ScheduledPaymentRecord this payment has EVER had (not just this
  // month) — already fetched for the page, so checking it here for the
  // Archivados delete-button decision costs no extra query.
  const everHadHistory = useMemo(() => new Set(records.map(r => r.scheduled_payment_id)), [records]);

  const archivedPayments = useMemo(() => payments.filter(p => p.is_active === false), [payments]);
  const nonArchived = useMemo(() => payments.filter(p => p.is_active !== false), [payments]);
  const pausedPayments = useMemo(() => nonArchived.filter(isTemporarilyPaused), [nonArchived]);
  const activePayments = useMemo(() => nonArchived.filter(p => !isTemporarilyPaused(p)), [nonArchived]);
  const automatedPayments = useMemo(() => activePayments.filter(p => p.automation_mode === 'auto'), [activePayments]);
  const manualPayments = useMemo(() => activePayments.filter(p => p.automation_mode !== 'auto'), [activePayments]);
  const paidPayments = useMemo(() => activePayments.filter(p => paidThisMonth.has(p.id)), [activePayments, paidThisMonth]);
  const pendingPayments = useMemo(() => activePayments.filter(p => !paidThisMonth.has(p.id) && !skippedThisMonth.has(p.id)), [activePayments, paidThisMonth, skippedThisMonth]);

  const filteredActive = activeFilter === 'paid' ? paidPayments
    : activeFilter === 'auto' ? automatedPayments
    : activeFilter === 'manual' ? manualPayments
    : pendingPayments;
  const viewList = activeView === 'archived' ? archivedPayments
    : activeView === 'paused' ? pausedPayments
    : filteredActive;
  const sorted = [...viewList].sort((a, b) => (a.due_day || 0) - (b.due_day || 0));

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
      const hasHistory = linkedRecords.length > 0 || linkedTransactions.length > 0;
      // An item with payment history that's already archived can't go any
      // further: re-running the same is_active:false update produced no
      // visible change at all — "Eliminar" looked completely broken on
      // anything in the Archivados tab with linked records. Preserving
      // financial history is correct (no hard-delete), but say so instead
      // of silently no-op'ing.
      if (hasHistory && item.is_active === false) {
        throw new Error(`"${item.name}" tiene historial de pagos vinculado — ya está archivado y no se puede eliminar del todo sin borrar ese historial.`);
      }
      if (hasHistory) {
        return base44.entities.ScheduledPayment.update(item.id, {
          is_active: false,
          archived_at: new Date().toISOString(),
          archived_by: currentUser?.full_name || currentUser?.email || 'Usuario',
        });
      }
      return base44.entities.ScheduledPayment.delete(item.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledPayments', familyId] }),
    onError: (err) => toast({ title: 'No se pudo eliminar', description: err?.message || 'No se pudo eliminar el pago programado.', variant: 'destructive' }),
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
      <PageHeader title="Pagos Programados" subtitle={`${pendingPayments.length} pendiente${pendingPayments.length !== 1 ? 's' : ''} este mes`}
        action={(isAdmin || canCreate) && (
          <button onClick={() => { setEditingItem(null); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        )} />

      <div className="px-4 space-y-3">
        {/* Lifecycle state — mutually exclusive, one item lives in exactly one of these */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveView('active')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${activeView === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            Activos ({activePayments.length})
          </button>
          <button onClick={() => setActiveView('paused')} className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold ${activeView === 'paused' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            <PauseCircle className="w-3 h-3" /> Pausados ({pausedPayments.length})
          </button>
          <button onClick={() => setActiveView('archived')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${activeView === 'archived' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            Archivados ({archivedPayments.length})
          </button>
        </div>

        {/* Secondary filter — only slices Activos, doesn't change lifecycle state */}
        {activeView === 'active' && (
          <div className="flex gap-1.5 flex-wrap">
            {[
              { key: 'pending', label: 'Pendientes', count: pendingPayments.length },
              { key: 'paid', label: 'Pagados este mes', count: paidPayments.length, icon: CheckCircle2 },
              { key: 'auto', label: 'Automáticos', count: automatedPayments.length, icon: Zap },
              { key: 'manual', label: 'Manuales', count: manualPayments.length, icon: Hand },
            ].map(f => {
              const Icon = f.icon;
              const selected = activeFilter === f.key;
              return (
                <button key={f.key} onClick={() => setActiveFilter(f.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${selected ? 'bg-primary/15 text-primary' : 'bg-transparent border border-border text-muted-foreground hover:bg-muted'}`}>
                  {Icon && <Icon className="w-3 h-3" />} {f.label} ({f.count})
                </button>
              );
            })}
          </div>
        )}

        {sorted.length === 0 ? (
          (() => {
            const empty = getEmptyState({ activeView, activeFilter, isAdmin });
            return (
              <div className="text-center py-12 bg-card border border-border rounded-2xl">
                <p className="text-3xl mb-2">{empty.icon}</p>
                <p className="text-sm font-semibold text-foreground">{empty.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{empty.subtitle}</p>
              </div>
            );
          })()
        ) : (
          sorted.map(item => {
            const cat = categories.find(c => c.id === item.category_id);
            const record = monthRecords.find(r => r.scheduled_payment_id === item.id);
            return (
              <ScheduledPaymentItem key={item.id} item={item} isPaid={paidThisMonth.has(item.id)} record={record} cat={cat}
                isUnmarking={unmarkingId === item.id} isAdmin={isAdmin}
                isPaused={isTemporarilyPaused(item)}
                hasHistory={everHadHistory.has(item.id)}
                onMarkPaid={(item) => { setPayingItem(item); setPayAmount(item.amount ? String(item.amount) : ''); setPayPaymentMethodId(item.payment_method_id || ''); setPayPersonId(persons[0]?.id || ''); }}
                onUnmark={handleUnmark} onEdit={(item) => { setEditingItem(item); setShowForm(true); }}
                onPauseUntil={setPausingItem}
                onResume={handleResume}
                onDelete={(selectedItem) => deleteMutation.mutate(selectedItem)} />
            );
          })
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
