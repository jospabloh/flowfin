import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { base44 } from '@/api/base44Client';
import { Plus, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { useFamily } from '@/lib/FamilyContext';
import { useToast } from '@/components/ui/use-toast';

import InvestmentCard from '@/components/investments/InvestmentCard';
import InvestmentDetailSheet from '@/components/investments/InvestmentDetailSheet';
import InvestmentPayFormModal from '@/components/investments/InvestmentPayFormModal';
import InvestmentFormSheet from '@/components/investments/InvestmentFormSheet';
import Spinner from '@/components/Spinner';
import { usePermission } from '@/lib/permissions/usePermission';
import { useFeatureGate } from '@/lib/permissions/useFeatureGate';
import PaywallPrompt from '@/components/billing/PaywallPrompt';
import { useCatalog } from '@/hooks/useCatalog';

const TODAY_ISO = new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { name: '', type: '', total_amount: '', total_payments: '', payment_amount: '', start_date: TODAY_ISO, payment_day: '28' };

export default function Investments() {
  const queryClient = useQueryClient();
  const { familyId } = useFamily();
  const { toast } = useToast();
  const gate = useFeatureGate('page.Investments');
  // registerPayment hook kept for other payment types; investments use direct creation below

  const { can_write: canCreate }        = usePermission('investment.crud.create');
  const { categories, persons, paymentMethods } = useCatalog(familyId);

  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [showPayFormSuccess, setShowPayFormSuccess] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [payError, setPayError] = useState('');
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPayForm, setEditPayForm] = useState({ amount: '', date: '', notes: '' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [payForm, setPayForm] = useState({ amount: '', date: TODAY_ISO, notes: '', person_id: '', category_id: '', payment_method_id: '' });

  const { data: investments = [], isLoading } = useQuery({ queryKey: ['investments', familyId], queryFn: () => base44.entities.Investment.filter({ family_id: familyId }, '-created_date'), enabled: !!familyId });
  const { data: allPayments = [] } = useQuery({ queryKey: ['investmentPayments'], queryFn: () => base44.entities.InvestmentPayment.list('-date') });

  const createInvestmentMutation = useMutation({
    mutationFn: (data) => base44.entities.Investment.create(data),
    onMutate: async (newInv) => {
      await queryClient.cancelQueries({ queryKey: ['investments', familyId] });
      const previous = queryClient.getQueryData(['investments', familyId]);
      queryClient.setQueryData(['investments', familyId], (old = []) => [{ ...newInv, id: `opt_${Date.now()}` }, ...old]);
      return { previous };
    },
    onError: (err, _, ctx) => { if (ctx?.previous) queryClient.setQueryData(['investments', familyId], ctx.previous); toast({ title: 'Error al crear inversión', description: err?.message, variant: 'destructive' }); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['investments', familyId] }),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.InvestmentPayment.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['investmentPayments'] });
      const previous = queryClient.getQueryData(['investmentPayments']);
      queryClient.setQueryData(['investmentPayments'], (old = []) => old.map(p => p.id === id ? { ...p, ...data } : p));
      return { previous };
    },
    onError: (err, _, ctx) => { if (ctx?.previous) queryClient.setQueryData(['investmentPayments'], ctx.previous); toast({ title: 'Error al actualizar pago', description: err?.message, variant: 'destructive' }); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['investmentPayments'] }),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id) => base44.entities.InvestmentPayment.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['investmentPayments'] });
      const previous = queryClient.getQueryData(['investmentPayments']);
      queryClient.setQueryData(['investmentPayments'], (old = []) => old.filter(p => p.id !== id));
      return { previous };
    },
    onError: (err, _, ctx) => { if (ctx?.previous) queryClient.setQueryData(['investmentPayments'], ctx.previous); toast({ title: 'Error al eliminar pago', description: err?.message, variant: 'destructive' }); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['investmentPayments'] }),
  });

  const handleCreate = () => {
    if (!form.name || !form.total_amount) return;
    createInvestmentMutation.mutate({ ...form, family_id: familyId, total_amount: +form.total_amount, total_payments: +form.total_payments, payment_amount: +form.payment_amount, payment_day: +form.payment_day, is_active: true });
    setShowForm(false); setForm(EMPTY_FORM);
  };

  const closePayForm = () => {
    if (isSavingPayment) return;
    setShowPayForm(false);
    setPayError('');
  };

  const handlePayment = async () => {
    if (!payForm.amount || !selected || isSavingPayment) return;
    setIsSavingPayment(true);
    setPayError('');
    const selectedPayments = allPayments.filter(p => p.investment_id === selected.id && (!p.date || p.date <= TODAY_ISO));
    const payData = { investment_id: selected.id, family_id: selected.family_id || familyId, payment_number: selectedPayments.length + 1, amount: +payForm.amount, date: payForm.date, notes: payForm.notes };
    let savedPayment;
    try {
      savedPayment = await base44.entities.InvestmentPayment.create(payData);
      if (payForm.category_id && payForm.person_id) {
        const week = (() => {
          try {
            const date = new Date(payForm.date + 'T12:00:00');
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
          } catch { return 1; }
        })();
        await base44.entities.Transaction.create({
          family_id: familyId,
          date: payForm.date,
          type: 'expense',
          amount: +payForm.amount,
          description: `Inversión: ${selected.name} — Pago #${selectedPayments.length + 1}${payForm.notes ? ` — ${payForm.notes}` : ''}`,
          category_id: payForm.category_id,
          payment_method_id: payForm.payment_method_id || undefined,
          person_id: payForm.person_id,
          required_type: 'Inversión',
          week,
          investment_payment_id: savedPayment.id,
        });
      }
    } catch (error) {
      // InvestmentPayment.create can succeed while the follow-up Transaction.create
      // throws (network blip, RLS rejection). Left alone, that orphans a payment
      // that shows as registered in Historial de pagos with nothing in Movimientos —
      // the entity hook backstop (createTransactionFromInvestmentPayment) can't help
      // here either, since InvestmentPayment doesn't store category_id/person_id for
      // it to resolve. Roll back the payment and surface the failure inline instead.
      if (savedPayment?.id) {
        try { await base44.entities.InvestmentPayment.delete(savedPayment.id); } catch { /* best-effort rollback */ }
      }
      setPayError(error?.message || 'No se pudo registrar el movimiento. Intenta de nuevo.');
      setIsSavingPayment(false);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['investmentPayments'] });
    queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
    queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });
    setIsSavingPayment(false);
    setShowPayForm(false); setShowPayFormSuccess(true);
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 }, colors: ['#059669', '#10B981', '#6EE7B7'] });
    setTimeout(() => setShowPayFormSuccess(false), 1800);
    setPayForm({ amount: '', date: TODAY_ISO, notes: '', person_id: '', category_id: '', payment_method_id: '' });
  };

  if (gate.status === 'loading') {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (gate.status === 'denied') {
    return (
      <div className="pb-4">
        <PageHeader title="Inversiones" subtitle="Mensualidades y rendimientos" />
        <PaywallPrompt feature="page.Investments" requiredPlan={gate.requiredPlan} />
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Success overlay — same confetti + spring-scaled checkmark as Capture's "money moment" */}
      <AnimatePresence>
        {showPayFormSuccess && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              className="w-24 h-24 rounded-full bg-income flex items-center justify-center shadow-2xl">
              <Check className="w-12 h-12 text-white" strokeWidth={3} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageHeader title="Inversiones" subtitle="Seguimiento de pagos"
        action={canCreate ? <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> Nueva</button> : null} />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : investments.length === 0 ? (
        <EmptyState icon="📈" title="Sin inversiones" description="Registra tu primera inversión o compromiso de pago" />
      ) : (
        <div className="px-4 space-y-3">
          {investments.map(inv => (
            <InvestmentCard key={inv.id} inv={inv} allPayments={allPayments} onSelect={setSelected}
              onQuickPay={(inv, _paid) => { setSelected(inv); setPayError(''); setPayForm({ amount: inv.payment_amount?.toString() || '', date: TODAY_ISO, notes: '', person_id: '', category_id: '', payment_method_id: '' }); setShowPayForm(true); }} />
          ))}
        </div>
      )}

      <InvestmentDetailSheet selected={selected} allPayments={allPayments} onClose={() => setSelected(null)}
        onPay={() => { setPayError(''); setShowPayForm(true); }}
        onEditPayment={(p) => { setEditingPayment(p); setEditPayForm({ amount: p.amount.toString(), date: p.date, notes: p.notes || '' }); }}
        onDeletePayment={(id) => deletePaymentMutation.mutate(id)} />

      <InvestmentPayFormModal show={!!editingPayment} title="Editar Pago" form={editPayForm} setForm={setEditPayForm}
        isSaving={updatePaymentMutation.isPending}
        onSave={() => { updatePaymentMutation.mutate({ id: editingPayment.id, data: { amount: +editPayForm.amount, date: editPayForm.date, notes: editPayForm.notes } }); setEditingPayment(null); }}
        onClose={() => setEditingPayment(null)} />

      <InvestmentPayFormModal show={showPayForm} title="Registrar Pago" form={payForm} setForm={setPayForm}
        onSave={handlePayment} onClose={closePayForm} error={payError} isSaving={isSavingPayment}
        investmentName={selected?.name}
        paymentNumber={selected ? allPayments.filter(p => p.investment_id === selected.id && (!p.date || p.date <= TODAY_ISO)).length + 1 : undefined}
        totalPayments={selected?.total_payments}
        persons={persons} categories={categories} paymentMethods={paymentMethods} />

      <InvestmentFormSheet show={showForm} form={form} setForm={setForm} onCreate={handleCreate} onClose={() => setShowForm(false)} />
    </div>
  );
}