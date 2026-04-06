import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, X, Loader2, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { useFamily } from '@/lib/FamilyContext';
import { useToast } from '@/components/ui/use-toast';
import { useBottomSheetStyle } from '@/hooks/useBottomSheetStyle';
import NativeSelect from '@/components/NativeSelect';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRegisterPaymentWithTransaction } from '@/hooks/useRegisterPaymentWithTransaction';
import { useCatalog } from '@/hooks/useCatalog';

export default function Rentals() {
  const queryClient = useQueryClient();
  const { familyId, currentUser } = useFamily();
  const { categories, paymentMethods, persons } = useCatalog(familyId);
  const { toast } = useToast();
  const registerPayment = useRegisterPaymentWithTransaction();
  const sheetStyle = useBottomSheetStyle(0.90);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showPayForm, setShowPayForm] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', tenant_name: '', base_rent: '', payment_day: '1', notes: '' });
  const [payForm, setPayForm] = useState({ amount: '', month: new Date().toISOString().slice(0,7), paid_by: '', payment_method_id: '', date_paid: new Date().toISOString().slice(0,10), notes: '' });

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
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    setForm({ name: '', address: '', tenant_name: '', base_rent: '', payment_day: '1', notes: '' });
  };

  const handlePayment = async () => {
    if (!payForm.amount || !selected) return;
    setIsSavingPayment(true);

    const amount = parseFloat(payForm.amount) || selected.base_rent || 0;
    const selectedPerson = persons.find(p => p.id === (payForm.paid_by || persons[0]?.id));
    const payData = {
      property_id: selected.id,
      month: payForm.month,
      amount,
      paid_by: selectedPerson?.name || currentUser?.full_name || currentUser?.email || 'Usuario',
      payment_method_id: payForm.payment_method_id || undefined,
      date_paid: payForm.date_paid,
      notes: payForm.notes || undefined,
      is_paid: true
    };

    try {
      await registerPayment(
        () => base44.entities.RentalPayment.create(payData),
        {
          type: 'income',
          amount,
          date: payForm.date_paid,
          description: `🏠 Renta ${selected.name}${payData.paid_by ? ` · ${payData.paid_by}` : ''} (${payForm.month})`,
          category_id: undefined,
          payment_method_id: payData.payment_method_id || undefined,
          person_id: payForm.paid_by || persons[0]?.id || undefined,
        }
      );
      queryClient.invalidateQueries({ queryKey: ['rentalPayments'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });

      toast({
        title: '✅ Cobro registrado',
        description: `${selected.name} · ${payForm.month}`,
        duration: 5000,
      });

      setShowPayForm(false);
      setPayForm({ amount: '', month: new Date().toISOString().slice(0,7), paid_by: '', payment_method_id: '', date_paid: new Date().toISOString().slice(0,10), notes: '' });
    } catch (error) {
      toast({
        title: 'Error al registrar cobro',
        description: error?.message || 'Intenta de nuevo.',
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setIsSavingPayment(false);
    }
  };

  return (
    <div className="pb-24">

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

      {/* Pay form — Bottom sheet */}
      <AnimatePresence>
        {showPayForm && selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => { if (!isSavingPayment) setShowPayForm(false); }} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border flex flex-col"
              style={sheetStyle}
            >
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3 flex-shrink-0" />
              <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
                <p className="text-sm font-bold text-foreground">Registrar cobro: {selected.name}</p>
                <button
                  onClick={() => { if (!isSavingPayment) setShowPayForm(false); }}
                  className="p-1.5 rounded-lg bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 overscroll-none hide-scrollbar px-5 py-4 space-y-3"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mes</p>
                  <input type="month" value={payForm.month} onChange={e => setPayForm(p => ({...p, month: e.target.value}))}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Monto cobrado</p>
                  <input type="number" placeholder={String(selected.base_rent)} value={payForm.amount} onChange={e => setPayForm(p => ({...p, amount: e.target.value}))}
                    inputMode="decimal"
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">¿Quién recibió el pago?</p>
                  <NativeSelect
                    value={payForm.paid_by}
                    onChange={e => setPayForm(p => ({...p, paid_by: e.target.value}))}
                    placeholder="Seleccionar"
                    options={[{ value: '', label: 'Sin especificar' }, ...persons.map(p => ({ value: p.id, label: p.name }))]}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Método de pago</p>
                  <NativeSelect
                    value={payForm.payment_method_id}
                    onChange={e => setPayForm(p => ({...p, payment_method_id: e.target.value}))}
                    placeholder="Sin especificar"
                    options={[{ value: '', label: 'Sin especificar' }, ...paymentMethods.map(m => ({ value: m.id, label: m.name }))]}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fecha del pago</p>
                  <input type="date" value={payForm.date_paid} onChange={e => setPayForm(p => ({...p, date_paid: e.target.value}))}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notas (opcional)</p>
                  <input placeholder="Referencia, observaciones..." value={payForm.notes} onChange={e => setPayForm(p => ({...p, notes: e.target.value}))}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <button
                  onClick={handlePayment}
                  disabled={isSavingPayment}
                  className="w-full py-3.5 bg-income text-white rounded-xl font-bold text-sm shadow-sm active:opacity-80 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[52px]"
                >
                  {isSavingPayment
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                    : <><Check className="w-4 h-4" /> Confirmar cobro</>
                  }
                </button>
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
              className="fixed bottom-0 left-0 right-0 z-[51] bg-card rounded-t-3xl border-t border-border p-5 flex flex-col"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)', maxHeight: '90vh' }}>
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-3 flex-shrink-0" />
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="font-bold text-foreground">Nueva Propiedad</h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>
              <div className="overflow-y-auto overscroll-none hide-scrollbar flex-1 space-y-3 mb-4">
                <input placeholder="Nombre (ej: DEPAS TOCHE)" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                <input placeholder="Inquilino" value={form.tenant_name} onChange={e => setForm(f => ({...f, tenant_name: e.target.value}))} className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                <input placeholder="Dirección" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Renta base" value={form.base_rent} onChange={e => setForm(f => ({...f, base_rent: e.target.value}))} inputMode="decimal" className="bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  <input type="number" placeholder="Día de pago" value={form.payment_day} onChange={e => setForm(f => ({...f, payment_day: e.target.value}))} min="1" max="28" className="bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <input placeholder="Notas" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <button onClick={handleCreate} disabled={!form.name || !form.base_rent} className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 active:opacity-80 min-h-[48px]">Crear Propiedad</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}