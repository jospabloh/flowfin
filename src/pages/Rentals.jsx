import { useState } from 'react';
import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, X, Building } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { useFamily } from '@/lib/FamilyContext';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Rentals() {
  const queryClient = useQueryClient();
  const { familyId } = useFamily();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showPayForm, setShowPayForm] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', tenant_name: '', base_rent: '', payment_day: '1', notes: '' });
  const [payForm, setPayForm] = useState({ amount: '', month: new Date().toISOString().slice(0,7), paid_by: '', deposit_account: '', date_paid: new Date().toISOString().slice(0,10), notes: '' });

  const { data: properties = [], isLoading } = useQuery({ queryKey: ['rentalProperties', familyId], queryFn: () => base44.entities.RentalProperty.filter({ family_id: familyId }, 'name'), enabled: !!familyId });
  const { data: payments = [] } = useQuery({ queryKey: ['rentalPayments'], queryFn: () => base44.entities.RentalPayment.list('-month') });

  const createPropertyMutation = useMutation({
    mutationFn: (data) => base44.entities.RentalProperty.create(data),
    onMutate: async (newProp) => {
      await queryClient.cancelQueries({ queryKey: ['rentalProperties', familyId] });
      const previous = queryClient.getQueryData(['rentalProperties', familyId]);
      const optimistic = { ...newProp, id: `opt_${Date.now()}` };
      queryClient.setQueryData(['rentalProperties', familyId], (old = []) => [...old, optimistic]);
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['rentalProperties', familyId], ctx.previous);
      toast({ title: 'Error al crear propiedad', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['rentalProperties', familyId] }),
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data) => base44.entities.RentalPayment.create(data),
    onMutate: async (newPay) => {
      await queryClient.cancelQueries({ queryKey: ['rentalPayments'] });
      const previous = queryClient.getQueryData(['rentalPayments']);
      const optimistic = { ...newPay, id: `opt_${Date.now()}` };
      queryClient.setQueryData(['rentalPayments'], (old = []) => [...old, optimistic]);
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['rentalPayments'], ctx.previous);
      toast({ title: 'Error al registrar cobro', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['rentalPayments'] }),
  });

  const handleCreate = async () => {
    if (!form.name || !form.base_rent) return;
    createPropertyMutation.mutate({ 
      ...form, 
      family_id: familyId, 
      base_rent: +form.base_rent, 
      payment_day: +form.payment_day, 
      is_active: true 
    });
    setShowForm(false);
    setForm({ name: '', address: '', tenant_name: '', base_rent: '', payment_day: '1', notes: '' });
  };

  const handlePayment = async () => {
    if (!payForm.amount || !selected) return;
    createPaymentMutation.mutate({ 
      ...payForm, 
      property_id: selected.id, 
      amount: +payForm.amount, 
      is_paid: true 
    });
    setShowPayForm(false);
    setPayForm({ amount: '', month: new Date().toISOString().slice(0,7), paid_by: '', deposit_account: '', date_paid: new Date().toISOString().slice(0,10), notes: '' });
  };

  return (
    <div className="pb-4">
      <PageHeader title="Rentas" subtitle="Cobro de propiedades"
        action={
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> Nueva
          </button>
        } />

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : properties.length === 0 ? (
        <EmptyState icon="🏠" title="Sin propiedades" description="Registra tus inmuebles para darles seguimiento de cobro" />
      ) : (
        <div className="px-4 space-y-3">
          {properties.map(prop => {
            const propPayments = payments.filter(p => p.property_id === prop.id);
            const thisMonth = new Date().toISOString().slice(0,7);
            const paidThisMonth = propPayments.some(p => p.month === thisMonth && p.is_paid);
            const totalCollected = propPayments.filter(p => p.is_paid).reduce((s, p) => s + p.amount, 0);
            return (
              <div key={prop.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${paidThisMonth ? 'bg-income' : 'bg-yellow-500'}`} />
                      <p className="text-sm font-semibold text-foreground">{prop.name}</p>
                    </div>
                    {prop.tenant_name && <p className="text-xs text-muted-foreground mt-0.5">Inquilino: {prop.tenant_name}</p>}
                    {prop.address && <p className="text-xs text-muted-foreground truncate">{prop.address}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:0}).format(prop.base_rent)}/mes</p>
                    <p className={`text-xs font-medium ${paidThisMonth ? 'text-income' : 'text-yellow-500'}`}>
                      {paidThisMonth ? '✓ Pagado este mes' : '⏳ Pendiente'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Total cobrado: {new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:0}).format(totalCollected)}</p>
                  <button onClick={() => { setSelected(prop); setShowPayForm(true); }}
                    className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-colors">
                    Registrar cobro
                  </button>
                </div>
                {propPayments.slice(0,3).map(pay => (
                  <div key={pay.id} className="flex items-center justify-between mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                    <span>{pay.month} · {pay.paid_by}</span>
                    <span className="text-income">{new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:0}).format(pay.amount)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Pay form */}
      <AnimatePresence>
        {showPayForm && selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowPayForm(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[51] bg-card rounded-2xl border border-border p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">Cobro: {selected.name}</h3>
                <button onClick={() => setShowPayForm(false)} className="p-2 rounded-xl bg-muted"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <input type="month" value={payForm.month} onChange={e => setPayForm(p => ({...p, month: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <input type="number" placeholder="Monto cobrado" value={payForm.amount} onChange={e => setPayForm(p => ({...p, amount: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <input placeholder="Quien pagó" value={payForm.paid_by} onChange={e => setPayForm(p => ({...p, paid_by: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <input placeholder="Depositado en" value={payForm.deposit_account} onChange={e => setPayForm(p => ({...p, deposit_account: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <input type="date" value={payForm.date_paid} onChange={e => setPayForm(p => ({...p, date_paid: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowPayForm(false)} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium">Cancelar</button>
                <button onClick={handlePayment} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Guardar</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* New property form */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowForm(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-[51] bg-card rounded-t-3xl border-t border-border p-5 pb-safe">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">Nueva Propiedad</h3>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl bg-muted"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <input placeholder="Nombre (ej: DEPAS TOCHE)" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <input placeholder="Inquilino" value={form.tenant_name} onChange={e => setForm(f => ({...f, tenant_name: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <input placeholder="Dirección" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Renta base" value={form.base_rent} onChange={e => setForm(f => ({...f, base_rent: e.target.value}))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                  <input type="number" placeholder="Día de pago" value={form.payment_day} onChange={e => setForm(f => ({...f, payment_day: e.target.value}))} className="bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
                </div>
                <input placeholder="Notas" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none" />
              </div>
              <button onClick={handleCreate} className="w-full mt-4 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm">Crear Propiedad</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}