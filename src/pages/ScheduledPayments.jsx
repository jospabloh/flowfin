import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { useCatalog } from '@/hooks/useCatalog';
import PageHeader from '@/components/PageHeader';
import { Plus } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useRegisterPaymentWithTransaction } from '@/hooks/useRegisterPaymentWithTransaction';
import { useToast } from '@/components/ui/use-toast';
import ScheduledPaymentItem from '@/components/scheduled/ScheduledPaymentItem';
import ScheduledPaymentMarkPaidSheet from '@/components/scheduled/ScheduledPaymentMarkPaidSheet';
import ScheduledPaymentForm from '@/components/scheduled/ScheduledPaymentForm';
import { todayISO } from '@/lib/formatters';
import { usePermission } from '@/lib/permissions/usePermission';

const TODAY = new Date();
const CURRENT_MONTH = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`;

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
  const pending = payments.filter(p => p.is_active !== false && !paidThisMonth.has(p.id) && !skippedThisMonth.has(p.id));
  const sorted = [...payments].sort((a, b) => (a.due_day || 0) - (b.due_day || 0));

  const createMutation = useMutation({ mutationFn: (data) => base44.entities.ScheduledPayment.create(data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledPayments', familyId] }) });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.ScheduledPayment.update(id, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledPayments', familyId] }) });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.ScheduledPayment.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledPayments', familyId] }) });

  const handleMarkPaid = async () => {
    if (!payingItem || isSavingPayment) return;
    setIsSavingPayment(true);
    const amount = parseFloat(payAmount) || payingItem.amount || 0;
    let primaryPersonId = payPersonId || payingItem.person_id || undefined;
    if (!primaryPersonId && persons.length > 0) primaryPersonId = persons[0].id;
    const selectedPerson = persons.find(p => p.id === primaryPersonId);
    const recordData = { scheduled_payment_id: payingItem.id, family_id: familyId, month: CURRENT_MONTH, paid_date: payDate, amount_paid: amount, notes: payNotes, paid_by: selectedPerson?.name || currentUser?.full_name || currentUser?.email || 'Usuario', status: 'reconciled', origin: 'manual' };
    try {
      await registerPayment(() => base44.entities.ScheduledPaymentRecord.create(recordData), {
        amount, date: payDate, description: `${payingItem.icon || ''} ${payingItem.name}${payNotes ? ` — ${payNotes}` : ''}`.trim(),
        category_id: payingItem.category_id || undefined, payment_method_id: payPaymentMethodId || payingItem.payment_method_id || undefined, person_id: primaryPersonId,
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
        {payments.length === 0 && (
          <div className="text-center py-12 bg-card border border-border rounded-2xl">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-sm font-semibold text-foreground">Sin pagos programados</p>
            <p className="text-xs text-muted-foreground mt-1">{isAdmin ? 'Agrega los pagos recurrentes del mes.' : 'El administrador aún no ha agregado pagos.'}</p>
          </div>
        )}
        {sorted.map(item => {
          const isPaid = paidThisMonth.has(item.id);
          const cat = categories.find(c => c.id === item.category_id);
          const record = monthRecords.find(r => r.scheduled_payment_id === item.id);
          return (
            <ScheduledPaymentItem key={item.id} item={item} isPaid={isPaid} record={record} cat={cat}
              isUnmarking={unmarkingId === item.id} isAdmin={isAdmin}
              onMarkPaid={(item) => { setPayingItem(item); setPayAmount(item.amount ? String(item.amount) : ''); setPayPaymentMethodId(item.payment_method_id || ''); setPayPersonId(persons[0]?.id || ''); }}
              onUnmark={handleUnmark} onEdit={(item) => { setEditingItem(item); setShowForm(true); }}
              onDelete={(id) => deleteMutation.mutate(id)} />
          );
        })}
      </div>

      <ScheduledPaymentMarkPaidSheet payingItem={payingItem} payAmount={payAmount} setPayAmount={setPayAmount}
        payDate={payDate} setPayDate={setPayDate} payPersonId={payPersonId} setPayPersonId={setPayPersonId}
        payPaymentMethodId={payPaymentMethodId} setPayPaymentMethodId={setPayPaymentMethodId}
        payNotes={payNotes} setPayNotes={setPayNotes} isSaving={isSavingPayment}
        persons={persons} paymentMethods={paymentMethods} onConfirm={handleMarkPaid} onClose={() => setPayingItem(null)} />

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
