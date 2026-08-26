import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { guardedCreate, guardedUpdate, guardedDelete } from '@/lib/guardedWrite';
import { useBottomSheetStyle } from '@/hooks/useBottomSheetStyle';
import { Plus, X, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ProgressBar from '@/components/ProgressBar';
import AmountDisplay from '@/components/AmountDisplay';
import EmptyState from '@/components/EmptyState';
import { useFamily } from '@/lib/FamilyContext';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, todayISO } from '@/lib/formatters';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm.jsx';
import Spinner from '@/components/Spinner';
import { parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useRegisterPaymentWithTransaction } from '@/hooks/useRegisterPaymentWithTransaction';
import { useCatalog } from '@/hooks/useCatalog';
import { usePermission } from '@/lib/permissions/usePermission';
import { useFeatureGate } from '@/lib/permissions/useFeatureGate';
import PaywallPrompt from '@/components/billing/PaywallPrompt';

function getNextMSIPayment(msi, payments) {
  const n = payments.length;
  if (n >= msi.total_months) return null;
  const today = new Date();
  const next = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(msi.billing_day || 2, 28));
  const diff = Math.ceil((next - today) / 86400000);
  return { number: n + 1, date: next, diff, remaining: msi.total_months - n };
}

export default function MSIPage() {
  const queryClient = useQueryClient();
  const { familyId, currency, familyConfig } = useFamily();
  const { can_write: canCreate }     = usePermission('msi.crud.create');
  const { can_write: canPay }        = usePermission('msi.payments.record');
  const gate = useFeatureGate('page.MSI');
  const locale = familyConfig?.locale || 'es-MX';
  const fmt = v => formatCurrency(v, { locale, currency });
  const { confirmDelete, ConfirmDialog } = useDeleteConfirm();
  const { toast } = useToast();
  const registerPayment = useRegisterPaymentWithTransaction();
  const { categories, paymentMethods, persons } = useCatalog(familyId);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPayForm, setEditPayForm] = useState({ amount: '', paid_date: '' });
  const [form, setForm] = useState({ store: '', concept: '', total_amount: '', monthly_amount: '', total_months: '', start_date: todayISO(), billing_day: '1', category_id: '', payment_method_id: '', person_id: '' });

  const { data: msiList = [], isLoading } = useQuery({ queryKey: ['msi', familyId], queryFn: () => base44.entities.MSI.filter({ family_id: familyId }, '-created_date'), enabled: !!familyId });
  const { data: allPayments = [] } = useQuery({ queryKey: ['msiPayments'], queryFn: () => base44.entities.MSIPayment.list('-paid_date') });

  const selectedPayments = selected ? allPayments.filter(p => p.msi_id === selected.id && p.paid_date && p.paid_date <= new Date().toISOString().slice(0, 10)) : [];
  const nextPayment = selected ? getNextMSIPayment(selected, selectedPayments) : null;

  const createMSIMutation = useMutation({
    mutationFn: (data) => guardedCreate('MSI', data),
    onMutate: async (newMSI) => {
      await queryClient.cancelQueries({ queryKey: ['msi', familyId] });
      const previous = queryClient.getQueryData(['msi', familyId]);
      const optimistic = { ...newMSI, id: `opt_${Date.now()}` };
      queryClient.setQueryData(['msi', familyId], (old = []) => [optimistic, ...old]);
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['msi', familyId], ctx.previous);
      toast({ title: 'Error al crear MSI', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['msi', familyId] }),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, data }) => guardedUpdate('MSIPayment', id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['msiPayments'] });
      const previous = queryClient.getQueryData(['msiPayments']);
      queryClient.setQueryData(['msiPayments'], (old = []) => old.map(p => p.id === id ? { ...p, ...data } : p));
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['msiPayments'], ctx.previous);
      toast({ title: 'Error al actualizar pago', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['msiPayments'] }),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id) => guardedDelete('MSIPayment', id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['msiPayments'] });
      const previous = queryClient.getQueryData(['msiPayments']);
      queryClient.setQueryData(['msiPayments'], (old = []) => old.filter(p => p.id !== id));
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['msiPayments'], ctx.previous);
      toast({ title: 'Error al eliminar pago', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['msiPayments'] }),
  });

  const toggleMSIStatusMutation = useMutation({
    mutationFn: (msi) => guardedUpdate('MSI', msi.id, { is_active: !msi.is_active }),
    onMutate: async (msi) => {
      await queryClient.cancelQueries({ queryKey: ['msi', familyId] });
      const previous = queryClient.getQueryData(['msi', familyId]);
      queryClient.setQueryData(['msi', familyId], (old = []) => old.map(m => m.id === msi.id ? { ...m, is_active: !m.is_active } : m));
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['msi', familyId], ctx.previous);
      toast({ title: 'Error al actualizar estado', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['msi', familyId] }),
  });

  const handleCreate = () => {
    if (!form.store || !form.total_amount) return;
    createMSIMutation.mutate({ 
      ...form, 
      family_id: familyId, 
      total_amount: +form.total_amount, 
      monthly_amount: +form.monthly_amount, 
      total_months: +form.total_months, 
      billing_day: +form.billing_day, 
      is_active: true 
    });
    setShowForm(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    setForm({ store: '', concept: '', total_amount: '', monthly_amount: '', total_months: '', start_date: todayISO(), billing_day: '1', category_id: '', payment_method_id: '', person_id: '' });
  };

  const sheetStyle = useBottomSheetStyle(0.90);

  const handleMarkPaid = async (msi, payments) => {
    const next = getNextMSIPayment(msi, payments);
    if (!next) return;
    // registerPayment only creates the matching Transaction when category_id AND
    // person_id are present. These used to be hardcoded `undefined` below, so every
    // MSI payment ever recorded saved the MSIPayment row and silently created no
    // movement — the mensualidad never reached Movimientos or any report. Block
    // before writing anything rather than reporting a success that never happened.
    const personId = msi.person_id || persons[0]?.id;
    if (!msi.category_id || !personId) {
      toast({
        title: 'Faltan datos para registrar el movimiento',
        description: `"${msi.store}" no tiene ${!msi.category_id ? 'rubro' : 'persona'} asignado. Edítalo y complétalo antes de marcar la mensualidad — si no, el pago no se reflejaría en Movimientos.`,
        variant: 'destructive',
        duration: 7000,
      });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const payData = {
      msi_id: msi.id,
      family_id: msi.family_id,
      month_number: next.number,
      amount: msi.monthly_amount,
      paid_date: today,
    };
    await registerPayment(
      () => guardedCreate('MSIPayment', payData),
      {
        amount: msi.monthly_amount,
        date: today,
        description: `MSI ${msi.store}${msi.concept ? ` — ${msi.concept}` : ''} · Mes ${next.number}/${msi.total_months}`,
        category_id: msi.category_id,
        payment_method_id: msi.payment_method_id || undefined,
        person_id: personId,
        link_field_from_primary: 'msi_payment_id',
      }
    );
    queryClient.invalidateQueries({ queryKey: ['msiPayments'] });
    queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
    queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });
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
        <PageHeader title="Meses sin intereses" subtitle="MSI activos y avance de pagos" />
        <PaywallPrompt feature="page.MSI" requiredPlan={gate.requiredPlan} />
      </div>
    );
  }

  return (
    <div className="pb-4">
      <ConfirmDialog />
      {/* Modal de MSI creado */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-income/10 flex items-center justify-center">
                  <span className="text-lg">✓</span>
                </div>
                <h3 className="font-semibold text-foreground">MSI creado ✓</h3>
              </div>
              <button
                onClick={() => setShowSuccess(false)}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">El registro se ha guardado correctamente.</p>
          </div>
        </div>
      )}

      <PageHeader title="MSI" subtitle="Meses Sin Intereses"
        action={canCreate && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> Nuevo
          </button>
        )} />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : msiList.length === 0 ? (
        <EmptyState icon="💳" title="Sin MSI" description="Registra tus compras a meses sin intereses" />
      ) : (
        <div className="px-4 space-y-3">
          {msiList.map(msi => {
            const payments = allPayments.filter(p => p.msi_id === msi.id);
            const next = getNextMSIPayment(msi, payments);
            const done = payments.length >= msi.total_months;
            const statusBg = done ? 'bg-income' : next?.diff < 0 ? 'bg-expense' : next?.diff <= 7 ? 'bg-yellow-500' : 'bg-income';
            return (
              <div key={msi.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusBg}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{msi.store}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${msi.is_active ? 'bg-income/10 text-income' : 'bg-amber-500/10 text-amber-600'}`}>
                          {msi.is_active ? 'Activo' : 'Pausa'}
                        </span>
                      </div>
                      {msi.concept && <p className="text-xs text-muted-foreground mt-0.5">{msi.concept}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{fmt(msi.monthly_amount)}/mes</p>
                    <p className="text-xs text-muted-foreground">{payments.length}/{msi.total_months} meses</p>
                  </div>
                </div>
                 <ProgressBar value={payments.length} max={msi.total_months} className="mb-2" />
                <button onClick={() => setSelected(msi)} className="w-full flex items-center justify-between text-left">
                  <div>
                    {!done && next && (
                      <p className={`text-xs ${next.diff <= 7 ? 'text-yellow-500 font-semibold' : 'text-muted-foreground'}`}>
                        Próximo: {format(next.date, 'dd MMM', { locale: es })} · {next.remaining} restantes
                      </p>
                    )}
                    {done && <p className="text-xs text-income font-semibold">✓ Pagado completamente</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50" onClick={() => setSelected(null)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border overflow-y-auto"
              style={sheetStyle}>
              <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
                <div className="flex-1">
                  <h3 className="font-bold text-foreground text-base">{selected.store}</h3>
                  {selected.concept && <p className="text-xs text-muted-foreground mt-0.5">{selected.concept}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleMSIStatusMutation.mutate(selected)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selected.is_active ? 'bg-income/10 text-income hover:bg-income/20' : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'}`}>
                    {selected.is_active ? 'Pausar' : 'Reactivar'}
                  </button>
                  <button onClick={() => setSelected(null)} className="p-2 rounded-xl bg-muted"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="p-4">
                <ProgressBar value={selectedPayments.length} max={selected.total_months} className="mb-3 h-3" />
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-muted rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Pagados</p>
                    <p className="text-xl font-bold text-foreground">{selectedPayments.length}</p>
                  </div>
                  <div className="bg-muted rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Pendientes</p>
                    <p className="text-xl font-bold text-foreground">{selected.total_months - selectedPayments.length}</p>
                  </div>
                  <div className="bg-muted rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Mensualidad</p>
                    <p className="text-sm font-bold text-foreground">{fmt(selected.monthly_amount)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-income/10 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Monto total</p>
                    <p className="text-lg font-bold text-income">{fmt(selected.total_amount)}</p>
                  </div>
                  <div className="bg-expense/10 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Monto pendiente</p>
                    <p className="text-lg font-bold text-expense">{fmt(selected.total_amount - selectedPayments.reduce((s, p) => s + p.amount, 0))}</p>
                  </div>
                </div>
                {nextPayment && (
                  <div className={`rounded-xl p-3 mb-4 ${nextPayment.diff < 0 ? 'bg-expense/10' : nextPayment.diff <= 7 ? 'bg-yellow-500/10' : 'bg-income/10'}`}>
                    <p className="text-xs font-semibold text-foreground">Próximo pago #{nextPayment.number}</p>
                    <p className="text-sm text-muted-foreground">{format(nextPayment.date, "dd 'de' MMMM yyyy", { locale: es })}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{nextPayment.diff < 0 ? `¡${Math.abs(nextPayment.diff)} días vencido!` : nextPayment.diff === 0 ? '¡Hoy!' : `En ${nextPayment.diff} días`}</p>
                  </div>
                )}
                {canPay && (
                  <button onClick={() => { handleMarkPaid(selected, selectedPayments); setSelected(null); }} className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm mb-4">
                    Registrar Pago
                  </button>
                )}
                <h4 className="text-sm font-semibold text-foreground mb-2">Historial de pagos</h4>
                <div className="space-y-2">
                  {selectedPayments.length === 0 ? <p className="text-sm text-muted-foreground">Sin pagos registrados</p>
                    : selectedPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex-1">
                          <p className="text-sm text-foreground">Mes #{p.month_number}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(p.paid_date), 'dd MMM yyyy', { locale: es })}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <AmountDisplay amount={p.amount} type="expense" size="sm" showSign={false} />
                          <button onClick={() => { setEditingPayment(p); setEditPayForm({ amount: p.amount.toString(), paid_date: p.paid_date }); }} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={async () => { if (await confirmDelete('¿Eliminar este pago?')) deletePaymentMutation.mutate(p.id); }} className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit payment modal */}
      <AnimatePresence>
        {editingPayment && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setEditingPayment(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[61] bg-card rounded-2xl border border-border p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">Editar Pago</h3>
                <button onClick={() => setEditingPayment(null)} className="p-2 rounded-xl bg-muted hover:bg-border transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <input type="number" placeholder="Monto" value={editPayForm.amount} onChange={e => setEditPayForm(p => ({...p, amount: e.target.value}))}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <input type="date" value={editPayForm.paid_date} onChange={e => setEditPayForm(p => ({...p, paid_date: e.target.value}))}
                  onClick={e => e.target.showPicker?.()}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none cursor-pointer" />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setEditingPayment(null)} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium">Cancelar</button>
                <button onClick={() => { updatePaymentMutation.mutate({ id: editingPayment.id, data: { amount: +editPayForm.amount, paid_date: editPayForm.paid_date } }); setEditingPayment(null); }} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Guardar</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* New MSI form */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowForm(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-[51] bg-card rounded-t-3xl border-t border-border p-5"
              style={{ ...sheetStyle, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">Nuevo MSI</h3>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl bg-muted"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <input placeholder="Tienda / Comercio" value={form.store} onChange={e => setForm(f => ({...f, store: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <input placeholder="Concepto (ej: BMW X3)" value={form.concept} onChange={e => setForm(f => ({...f, concept: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Monto total" value={form.total_amount} onChange={e => setForm(f => ({...f, total_amount: e.target.value}))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                  <input type="number" placeholder="$ mensualidad" value={form.monthly_amount} onChange={e => setForm(f => ({...f, monthly_amount: e.target.value}))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="# meses" value={form.total_months} onChange={e => setForm(f => ({...f, total_months: e.target.value}))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                  <input type="number" placeholder="Día de cargo" value={form.billing_day} onChange={e => setForm(f => ({...f, billing_day: e.target.value}))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                </div>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} onClick={e => e.target.showPicker?.()} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none cursor-pointer" />
                {/* Rubro y persona son obligatorios para que cada mensualidad
                    genere su movimiento: sin ellos handleMarkPaid se bloquea. */}
                <select value={form.category_id} onChange={e => setForm(f => ({...f, category_id: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none">
                  <option value="">Rubro (necesario para el movimiento)</option>
                  {(categories || []).filter(c => c.type === 'both' || c.type === 'expense').map(c => (
                    <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                  ))}
                </select>
                <select value={form.person_id} onChange={e => setForm(f => ({...f, person_id: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none">
                  <option value="">Persona responsable</option>
                  {(persons || []).map(pp => (
                    <option key={pp.id} value={pp.id}>{pp.name}</option>
                  ))}
                </select>
                <select value={form.payment_method_id} onChange={e => setForm(f => ({...f, payment_method_id: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none">
                  <option value="">Forma de pago</option>
                  {(paymentMethods || []).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleCreate} className="w-full mt-4 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm">Crear MSI</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
