import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, TrendingUp, ChevronRight, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ProgressBar from '@/components/ProgressBar';
import AmountDisplay from '@/components/AmountDisplay';
import EmptyState from '@/components/EmptyState';
import { useFamily } from '@/lib/FamilyContext';
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
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: '', total_amount: '', total_payments: '', payment_amount: '', start_date: new Date().toISOString().slice(0,10), payment_day: '28' });
  const [payForm, setPayForm] = useState({ amount: '', date: new Date().toISOString().slice(0,10), notes: '' });

  const { data: investments = [], isLoading } = useQuery({ queryKey: ['investments', familyId], queryFn: () => base44.entities.Investment.filter({ family_id: familyId }, '-created_date'), enabled: !!familyId });
  const { data: allPayments = [] } = useQuery({ queryKey: ['investmentPayments'], queryFn: () => base44.entities.InvestmentPayment.list('-date') });

  const selectedPayments = selected ? allPayments.filter(p => p.investment_id === selected.id) : [];
  const nextPayment = selected ? getNextPayment(selected, selectedPayments) : null;

  const handleCreate = async () => {
    if (!form.name || !form.total_amount) return;
    await base44.entities.Investment.create({ ...form, family_id: familyId, total_amount: +form.total_amount, total_payments: +form.total_payments, payment_amount: +form.payment_amount, payment_day: +form.payment_day, is_active: true });
    queryClient.invalidateQueries({ queryKey: ['investments', familyId] });
    setShowForm(false);
    setForm({ name: '', type: '', total_amount: '', total_payments: '', payment_amount: '', start_date: new Date().toISOString().slice(0,10), payment_day: '28' });
  };

  const handlePayment = async () => {
    if (!payForm.amount || !selected) return;
    await base44.entities.InvestmentPayment.create({ investment_id: selected.id, payment_number: selectedPayments.length + 1, amount: +payForm.amount, date: payForm.date, notes: payForm.notes });
    queryClient.invalidateQueries({ queryKey: ['investmentPayments'] });
    setShowPayForm(false);
  };

  return (
    <div className="pb-4">
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
            const paid = allPayments.filter(p => p.investment_id === inv.id).length;
            const next = getNextPayment(inv, allPayments.filter(p => p.investment_id === inv.id));
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
                        <div>
                          <p className="text-sm text-foreground">Pago #{p.payment_number}</p>
                          <p className="text-xs text-muted-foreground">{p.date}</p>
                        </div>
                        <AmountDisplay amount={p.amount} type="expense" size="sm" showSign={false} />
                      </div>
                    ))}
                </div>
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
              <h3 className="font-bold text-foreground mb-4">Registrar Pago</h3>
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