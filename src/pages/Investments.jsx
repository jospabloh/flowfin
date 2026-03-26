import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, TrendingUp, ChevronRight, X, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ProgressBar from '@/components/ProgressBar';
import AmountDisplay from '@/components/AmountDisplay';
import EmptyState from '@/components/EmptyState';
import { useFamily } from '@/lib/FamilyContext';
import { useToast } from '@/components/ui/use-toast';
import { format, addMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

function getNextPayment(inv, paymentsMade) {
  const n = paymentsMade.length;
  if (n >= inv.total_payments) return null;
  const base = parseISO(inv.start_date);
  const next = addMonths(base, n);
  if (inv.payment_day) next.setDate(Math.min(inv.payment_day, 28));
  const diff = Math.ceil((next - new Date()) / 86400000);
  return { number: n + 1, date: next, diff, remaining: inv.total_payments - n };
}

function statusColor(diff) {
  if (diff === undefined || diff === null) return 'bg-income';
  if (diff < 0) return 'bg-expense';
  if (diff <= 7) return 'bg-yellow-500';
  return 'bg-income';
}

export default function Investments() {
  const queryClient = useQueryClient();
  const { familyId } = useFamily();
  const { toast } = useToast();
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [showPayFormSuccess, setShowPayFormSuccess] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPayForm, setEditPayForm] = useState({ amount: '', date: '', notes: '' });
  const [form, setForm] = useState({ name: '', type: '', total_amount: '', total_payments: '', payment_amount: '', start_date: new Date().toISOString().slice(0,10), payment_day: '28' });
  const [payForm, setPayForm] = useState({ amount: '', date: new Date().toISOString().slice(0,10), notes: '' });

  const { data: investments = [], isLoading } = useQuery({ queryKey: ['investments', familyId], queryFn: () => base44.entities.Investment.filter({ family_id: familyId }, '-created_date'), enabled: !!familyId });
  const { data: allPayments = [] } = useQuery({ queryKey: ['investmentPayments'], queryFn: () => base44.entities.InvestmentPayment.list('-date') });

  const selectedPayments = selected ? allPayments.filter(p => p.investment_id === selected.id && (!p.date || p.date <= new Date().toISOString().slice(0, 10))) : [];
  const nextPayment = selected ? getNextPayment(selected, selectedPayments) : null;

  const createInvestmentMutation = useMutation({
    mutationFn: (data) => base44.entities.Investment.create(data),
    onMutate: async (newInv) => {
      await queryClient.cancelQueries({ queryKey: ['investments', familyId] });
      const previous = queryClient.getQueryData(['investments', familyId]);
      const optimistic = { ...newInv, id: `opt_${Date.now()}` };
      queryClient.setQueryData(['investments', familyId], (old = []) => [optimistic, ...old]);
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['investments', familyId], ctx.previous);
      toast({ title: 'Error al crear inversión', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['investments', familyId] }),
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data) => base44.entities.InvestmentPayment.create(data),
    onMutate: async (newPay) => {
      await queryClient.cancelQueries({ queryKey: ['investmentPayments'] });
      const previous = queryClient.getQueryData(['investmentPayments']);
      const optimistic = { ...newPay, id: `opt_${Date.now()}` };
      queryClient.setQueryData(['investmentPayments'], (old = []) => [...old, optimistic]);
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['investmentPayments'], ctx.previous);
      toast({ title: 'Error al registrar pago', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['investmentPayments'] }),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.InvestmentPayment.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['investmentPayments'] });
      const previous = queryClient.getQueryData(['investmentPayments']);
      queryClient.setQueryData(['investmentPayments'], (old = []) => old.map(p => p.id === id ? { ...p, ...data } : p));
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['investmentPayments'], ctx.previous);
      toast({ title: 'Error al actualizar pago', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' });
    },
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
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['investmentPayments'], ctx.previous);
      toast({ title: 'Error al eliminar pago', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['investmentPayments'] }),
  });

  const handleCreate = async () => {
    if (!form.name || !form.total_amount) return;
    createInvestmentMutation.mutate({ 
      ...form, 
      family_id: familyId, 
      total_amount: +form.total_amount, 
      total_payments: +form.total_payments, 
      payment_amount: +form.payment_amount, 
      payment_day: +form.payment_day, 
      is_active: true 
    });
    setShowForm(false);
    setForm({ name: '', type: '', total_amount: '', total_payments: '', payment_amount: '', start_date: new Date().toISOString().slice(0,10), payment_day: '28' });
  };

  const handlePayment = async () => {
    if (!payForm.amount || !selected) return;
    createPaymentMutation.mutate({ 
      investment_id: selected.id, 
      payment_number: selectedPayments.length + 1, 
      amount: +payForm.amount, 
      date: payForm.date, 
      notes: payForm.notes 
    });
    setShowPayForm(false);
    setShowPayFormSuccess(true);
    setTimeout(() => setShowPayFormSuccess(false), 3000);
    setPayForm({ amount: '', date: new Date().toISOString().slice(0,10), notes: '' });
  };

  return (
    <div className="pb-4">
      {/* Modal de pago guardado */}
      {showPayFormSuccess && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-income/10 flex items-center justify-center">
                  <span className="text-lg">✓</span>
                </div>
                <h3 className="font-semibold text-foreground">Pago registrado ✓</h3>
              </div>
              <button
                onClick={() => setShowPayFormSuccess(false)}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">El pago se ha registrado correctamente.</p>
          </div>
        </div>
      )}

      <PageHeader title="Inversiones" subtitle="Seguimiento de pagos"
        action={
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> Nueva
          </button>
        } />

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : investments.length === 0 ? (
        <EmptyState icon="📈" title="Sin inversiones" description="Registra tu primera inversión o compromiso de pago" />
      ) : (
        <div className="px-4 space-y-3">
          {investments.map(inv => {
            const paid = allPayments.filter(p => p.investment_id === inv.id && (!p.date || p.date <= new Date().toISOString().slice(0, 10))).length;
            const next = getNextPayment(inv, allPayments.filter(p => p.investment_id === inv.id && (!p.date || p.date <= new Date().toISOString().slice(0, 10))));
            const done = paid >= inv.total_payments;
            return (
              <button key={inv.id} onClick={() => setSelected(inv)} className="w-full bg-card border border-border rounded-2xl p-4 text-left shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${done ? 'bg-income' : next ? statusColor(next.diff) : 'bg-muted'}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{inv.name}</p>
                      {inv.type && <p className="text-xs text-muted-foreground">{inv.type}</p>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                </div>
                <ProgressBar value={paid} max={inv.total_payments} className="mb-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{paid} / {inv.total_payments} pagos</span>
                  {!done && next && (
                    <span className={next.diff <= 7 ? 'text-yellow-500 font-semibold' : ''}>
                      Próximo: {format(next.date, 'dd MMM', { locale: es })}
                    </span>
                  )}
                  {done && <span className="text-income font-semibold">✓ Completado</span>}
                </div>
                {inv.payment_amount > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:0}).format(inv.payment_amount)} / pago</p>
                )}
              </button>
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
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border max-h-[85vh] overflow-y-auto pb-safe">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-bold text-foreground text-base">{selected.name}</h3>
                <button onClick={() => setSelected(null)} className="p-2 rounded-xl bg-muted"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4">
                <ProgressBar value={selectedPayments.length} max={selected.total_payments} className="mb-3 h-3" />
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-muted rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Pagos realizados</p>
                    <p className="text-xl font-bold text-foreground">{selectedPayments.length} <span className="text-sm font-normal text-muted-foreground">/ {selected.total_payments}</span></p>
                  </div>
                  <div className="bg-muted rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Restantes</p>
                    <p className="text-xl font-bold text-foreground">{selected.total_payments - selectedPayments.length}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-income/10 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Monto total</p>
                    <p className="text-lg font-bold text-income">{new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:0}).format(selected.total_amount)}</p>
                  </div>
                  <div className="bg-expense/10 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Monto pendiente</p>
                    <p className="text-lg font-bold text-expense">{new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:0}).format((selected.total_amount) - (selectedPayments.reduce((s, p) => s + p.amount, 0)))}</p>
                  </div>
                </div>
                {nextPayment && (
                  <div className={`rounded-xl p-3 mb-4 ${nextPayment.diff < 0 ? 'bg-expense/10' : nextPayment.diff <= 7 ? 'bg-yellow-500/10' : 'bg-income/10'}`}>
                    <p className="text-xs font-semibold text-foreground">Próximo pago #{nextPayment.number}</p>
                    <p className="text-sm text-muted-foreground">{format(nextPayment.date, "dd 'de' MMMM yyyy", { locale: es })}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{nextPayment.diff < 0 ? `¡${Math.abs(nextPayment.diff)} días vencido!` : nextPayment.diff === 0 ? '¡Hoy!' : `En ${nextPayment.diff} días`}</p>
                  </div>
                )}
                <button onClick={() => setShowPayForm(true)} className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm mb-4">
                  Registrar Pago
                </button>
                <h4 className="text-sm font-semibold text-foreground mb-2">Historial de pagos</h4>
                <div className="space-y-2">
                  {selectedPayments.length === 0 ? <p className="text-sm text-muted-foreground">Sin pagos registrados</p>
                    : selectedPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex-1">
                          <p className="text-sm text-foreground">Pago #{p.payment_number}</p>
                          <p className="text-xs text-muted-foreground">{p.date}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <AmountDisplay amount={p.amount} type="expense" size="sm" showSign={false} />
                          <button onClick={() => { setEditingPayment(p); setEditPayForm({ amount: p.amount.toString(), date: p.date, notes: p.notes || '' }); }} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => { if (confirm('¿Eliminar este pago?')) deletePaymentMutation.mutate(p.id); }} className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors">
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
               <input type="date" value={editPayForm.date} onChange={e => setEditPayForm(p => ({...p, date: e.target.value}))}
                 className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
               <input type="text" placeholder="Notas (opcional)" value={editPayForm.notes} onChange={e => setEditPayForm(p => ({...p, notes: e.target.value}))}
                 className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
             </div>
             <div className="flex gap-2 mt-4">
               <button onClick={() => setEditingPayment(null)} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium">Cancelar</button>
               <button onClick={() => { updatePaymentMutation.mutate({ id: editingPayment.id, data: { amount: +editPayForm.amount, date: editPayForm.date, notes: editPayForm.notes } }); setEditingPayment(null); }} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Guardar</button>
             </div>
           </motion.div>
         </>
       )}
      </AnimatePresence>

      {/* Pay form */}
      <AnimatePresence>
        {showPayForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setShowPayForm(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[61] bg-card rounded-2xl border border-border p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">Registrar Pago</h3>
                <button onClick={() => setShowPayForm(false)} className="p-2 rounded-xl bg-muted hover:bg-border transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <input type="number" placeholder="Monto" value={payForm.amount} onChange={e => setPayForm(p => ({...p, amount: e.target.value}))}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <input type="date" value={payForm.date} onChange={e => setPayForm(p => ({...p, date: e.target.value}))}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <input type="text" placeholder="Notas (opcional)" value={payForm.notes} onChange={e => setPayForm(p => ({...p, notes: e.target.value}))}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowPayForm(false)} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium">Cancelar</button>
                <button onClick={handlePayment} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Guardar</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* New investment form */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setShowForm(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-[61] bg-card rounded-t-3xl border-t border-border p-5 pb-safe">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">Nueva Inversión</h3>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl bg-muted"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <input placeholder="Nombre (ej: LOCAL 03 ST. ANGELO)" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <input placeholder="Tipo (inmueble, fondo, etc.)" value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Monto total" value={form.total_amount} onChange={e => setForm(f => ({...f, total_amount: e.target.value}))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                  <input type="number" placeholder="# pagos" value={form.total_payments} onChange={e => setForm(f => ({...f, total_payments: e.target.value}))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="$ por pago" value={form.payment_amount} onChange={e => setForm(f => ({...f, payment_amount: e.target.value}))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                  <input type="number" placeholder="Día de pago (1-28)" value={form.payment_day} onChange={e => setForm(f => ({...f, payment_day: e.target.value}))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                </div>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
              </div>
              <button onClick={handleCreate} className="w-full mt-4 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm">Crear Inversión</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}