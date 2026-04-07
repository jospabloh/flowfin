import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, X, Loader2, Check, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { useFamily } from '@/lib/FamilyContext';
import { useToast } from '@/components/ui/use-toast';
import { useBottomSheetStyle } from '@/hooks/useBottomSheetStyle';
import NativeSelect from '@/components/NativeSelect';
import { motion, AnimatePresence } from 'framer-motion';

function getWeekNumber(dateStr) {
  try {
    const date = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  } catch { return 1; }
}

function fmt(amount) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(amount || 0);
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);
const THIS_MONTH = new Date().toISOString().slice(0, 7);
const EMPTY_PROP_FORM = { name: '', address: '', tenant_name: '', base_rent: '', payment_day: '', notes: '' };

export default function Rentals() {
  const queryClient = useQueryClient();
  const { familyId, currentUser } = useFamily();
  const { toast } = useToast();
  const sheetStyle = useBottomSheetStyle(0.90);

  const [showPropForm, setShowPropForm] = useState(false);
  const [editingProp, setEditingProp] = useState(null);
  const [propForm, setPropForm] = useState(EMPTY_PROP_FORM);

  const [showPayForm, setShowPayForm] = useState(false);
  const [selectedProp, setSelectedProp] = useState(null);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [unmarkingId, setUnmarkingId] = useState(null);
  const [payForm, setPayForm] = useState({
    amount: '', month: THIS_MONTH, paid_by_id: '', payment_method_id: '', date_paid: TODAY_ISO, notes: '',
  });

  // ── queries ──────────────────────────────────────────────────────────────

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['rentalProperties', familyId],
    queryFn: () => base44.entities.RentalProperty.filter({ family_id: familyId }, 'name'),
    enabled: !!familyId,
  });

  const { data: rentalPayments = [] } = useQuery({
    queryKey: ['rentalPayments', familyId],
    queryFn: () => base44.entities.RentalPayment.filter({ family_id: familyId }, '-month'),
    enabled: !!familyId,
  });

  const { data: persons = [] } = useQuery({
    queryKey: ['persons', familyId],
    queryFn: () => base44.entities.Person.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['paymentMethods', familyId],
    queryFn: () => base44.entities.PaymentMethod.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
  });

  // ── get or create "Rentas" income category ────────────────────────────────

  async function getRentasCategoryId() {
    const cats = await base44.entities.Category.filter({ family_id: familyId });
    const existing = cats.find(c =>
      c.name?.toLowerCase() === 'rentas' && (c.type === 'income' || c.type === 'both')
    );
    if (existing) return existing.id;
    const created = await base44.entities.Category.create({
      family_id: familyId,
      name: 'Rentas',
      type: 'income',
      icon: '🏠',
      color: '#059669',
    });
    queryClient.invalidateQueries({ queryKey: ['categories', familyId] });
    return created.id;
  }

  // ── property mutations ────────────────────────────────────────────────────

  const savePropMutation = useMutation({
    mutationFn: (data) =>
      editingProp
        ? base44.entities.RentalProperty.update(editingProp.id, data)
        : base44.entities.RentalProperty.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentalProperties', familyId] });
      setShowPropForm(false);
      setEditingProp(null);
      setPropForm(EMPTY_PROP_FORM);
      toast({ title: editingProp ? '✅ Propiedad actualizada' : '✅ Propiedad creada', duration: 3000 });
    },
    onError: (err) => toast({ title: 'Error', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' }),
  });

  const deletePropMutation = useMutation({
    mutationFn: (id) => base44.entities.RentalProperty.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentalProperties', familyId] });
      toast({ title: '🗑️ Propiedad eliminada', duration: 3000 });
    },
    onError: (err) => toast({ title: 'Error al eliminar', description: err?.message, variant: 'destructive' }),
  });

  function openNewProp() {
    setEditingProp(null);
    setPropForm(EMPTY_PROP_FORM);
    setShowPropForm(true);
  }

  function openEditProp(prop) {
    setEditingProp(prop);
    setPropForm({
      name: prop.name || '',
      address: prop.address || '',
      tenant_name: prop.tenant_name || '',
      base_rent: prop.base_rent != null ? String(prop.base_rent) : '',
      payment_day: prop.payment_day != null ? String(prop.payment_day) : '',
      notes: prop.notes || '',
    });
    setShowPropForm(true);
  }

  function handleDeleteProp(prop) {
    if (!window.confirm(`¿Eliminar "${prop.name}"? Esta acción no se puede deshacer.`)) return;
    deletePropMutation.mutate(prop.id);
  }

  function handleSaveProp() {
    if (!propForm.name.trim() || !propForm.base_rent) return;
    savePropMutation.mutate({
      family_id: familyId,
      name: propForm.name.trim(),
      address: propForm.address.trim() || undefined,
      tenant_name: propForm.tenant_name.trim() || undefined,
      base_rent: parseFloat(propForm.base_rent) || 0,
      payment_day: propForm.payment_day ? parseInt(propForm.payment_day) : undefined,
      notes: propForm.notes.trim() || undefined,
      is_active: true,
    });
  }

  // ── pay / unmark ──────────────────────────────────────────────────────────

  function openPayForm(prop) {
    setSelectedProp(prop);
    setPayForm({
      amount: prop.base_rent ? String(prop.base_rent) : '',
      month: THIS_MONTH,
      paid_by_id: persons[0]?.id || '',
      payment_method_id: '',
      date_paid: TODAY_ISO,
      notes: '',
    });
    setShowPayForm(true);
  }

  async function handleConfirmPayment() {
    if (!selectedProp || isSavingPayment) return;
    setIsSavingPayment(true);
    const amount = parseFloat(payForm.amount) || selectedProp.base_rent || 0;
    const person = persons.find(p => p.id === payForm.paid_by_id);

    try {
      // duplicate guard
      const existing = rentalPayments.find(
        p => p.property_id === selectedProp.id && p.month === payForm.month && p.is_paid
      );
      if (existing) {
        toast({ title: 'Ya existe un cobro para este mes', description: 'Desmarca el cobro existente antes de registrar uno nuevo.', variant: 'destructive' });
        return;
      }

      const categoryId = await getRentasCategoryId();

      // 1. Create rental payment record
      const rentalPaymentRecord = await base44.entities.RentalPayment.create({
        property_id: selectedProp.id,
        family_id: familyId,
        month: payForm.month,
        amount,
        paid_by: person?.name || currentUser?.full_name || 'Usuario',
        payment_method_id: payForm.payment_method_id || undefined,
        date_paid: payForm.date_paid,
        notes: payForm.notes || undefined,
        is_paid: true,
      });

      // 2. Create linked income transaction
      await base44.entities.Transaction.create({
        family_id: familyId,
        date: payForm.date_paid,
        type: 'income',
        amount,
        description: `🏠 Renta ${selectedProp.name}${selectedProp.tenant_name ? ` · ${selectedProp.tenant_name}` : ''} (${payForm.month})`,
        category_id: categoryId,
        payment_method_id: payForm.payment_method_id || undefined,
        person_id: payForm.paid_by_id || undefined,
        required_type: 'Otro',
        week: getWeekNumber(payForm.date_paid),
        rental_payment_id: rentalPaymentRecord.id,
      });

      queryClient.invalidateQueries({ queryKey: ['rentalPayments', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });

      toast({ title: '✅ Cobro registrado', description: `${selectedProp.name} · ${payForm.month}`, duration: 5000 });
      setShowPayForm(false);
    } catch (error) {
      toast({ title: 'Error al registrar cobro', description: error?.message || 'Intenta de nuevo.', variant: 'destructive', duration: 5000 });
    } finally {
      setIsSavingPayment(false);
    }
  }

  async function handleUnmark(prop, payRecord) {
    if (unmarkingId) return;
    if (!window.confirm(`¿Desmarcar el cobro de ${payRecord.month} para "${prop.name}"? Se eliminará el ingreso vinculado.`)) return;
    setUnmarkingId(payRecord.id);
    try {
      const linked = await base44.entities.Transaction.filter({ rental_payment_id: payRecord.id });
      for (const tx of linked) {
        await base44.entities.Transaction.delete(tx.id);
      }
      await base44.entities.RentalPayment.delete(payRecord.id);

      queryClient.invalidateQueries({ queryKey: ['rentalPayments', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });

      toast({ title: '↩️ Cobro desmarcado', description: `Ingreso de ${prop.name} eliminado.`, duration: 4000 });
    } catch (err) {
      toast({ title: 'Error al desmarcar', description: err?.message, variant: 'destructive' });
    } finally {
      setUnmarkingId(null);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="pb-24">
      <PageHeader
        title="Rentas"
        subtitle="Cobro de propiedades"
        action={
          <button onClick={openNewProp} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> Nueva
          </button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : properties.length === 0 ? (
        <EmptyState icon="🏠" title="Sin propiedades" description="Registra tus inmuebles para darles seguimiento de cobro" />
      ) : (
        <div className="px-4 space-y-3">
          {properties.map(prop => {
            const propPayments = rentalPayments.filter(p => p.property_id === prop.id);
            const thisMonthRecord = propPayments.find(p => p.month === THIS_MONTH && p.is_paid);
            const paidThisMonth = !!thisMonthRecord;
            const totalCollected = propPayments.filter(p => p.is_paid).reduce((s, p) => s + (p.amount || 0), 0);

            return (
              <div key={prop.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${paidThisMonth ? 'bg-income' : 'bg-yellow-500'}`} />
                      <p className="text-sm font-semibold text-foreground truncate">{prop.name}</p>
                    </div>
                    {prop.tenant_name && <p className="text-xs text-muted-foreground mt-0.5">Inquilino: {prop.tenant_name}</p>}
                    {prop.address && <p className="text-xs text-muted-foreground truncate">{prop.address}</p>}
                    {prop.payment_day && <p className="text-xs text-muted-foreground">Día de cobro: {prop.payment_day}</p>}
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-sm font-bold text-foreground">{fmt(prop.base_rent)}/mes</p>
                    <p className={`text-xs font-medium ${paidThisMonth ? 'text-income' : 'text-yellow-500'}`}>
                      {paidThisMonth ? '✓ Cobrado este mes' : '⏳ Pendiente'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                  <p className="text-xs text-muted-foreground">Total cobrado: {fmt(totalCollected)}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditProp(prop)}
                      className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Editar propiedad"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProp(prop)}
                      disabled={deletePropMutation.isPending}
                      className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="Eliminar propiedad"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {paidThisMonth ? (
                      <button
                        onClick={() => handleUnmark(prop, thisMonthRecord)}
                        disabled={unmarkingId === thisMonthRecord?.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-semibold disabled:opacity-60 transition-opacity"
                      >
                        {unmarkingId === thisMonthRecord?.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Check className="w-3.5 h-3.5" />}
                        Desmarcar
                      </button>
                    ) : (
                      <button
                        onClick={() => openPayForm(prop)}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        Registrar cobro
                      </button>
                    )}
                  </div>
                </div>

                {propPayments.slice(0, 3).map(pay => (
                  <div key={pay.id} className="flex items-center justify-between mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                    <span>{pay.month}{pay.paid_by ? ` · ${pay.paid_by}` : ''}</span>
                    <span className="text-income font-medium">{fmt(pay.amount)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Collect/Pay bottom sheet ──────────────────────────────────────── */}
      <AnimatePresence>
        {showPayForm && selectedProp && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => { if (!isSavingPayment) setShowPayForm(false); }}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border flex flex-col"
              style={sheetStyle}
            >
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3 flex-shrink-0" />
              <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
                <p className="text-sm font-bold text-foreground">Registrar cobro: {selectedProp.name}</p>
                <button onClick={() => { if (!isSavingPayment) setShowPayForm(false); }}
                  className="p-1.5 rounded-lg bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 overscroll-none hide-scrollbar px-5 py-4 space-y-3"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mes a cobrar</p>
                  <input type="month" value={payForm.month}
                    onChange={e => setPayForm(p => ({ ...p, month: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Monto cobrado</p>
                  <input type="number" inputMode="decimal"
                    placeholder={String(selectedProp.base_rent || '')}
                    value={payForm.amount}
                    onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fecha del cobro</p>
                  <input type="date" value={payForm.date_paid}
                    onChange={e => setPayForm(p => ({ ...p, date_paid: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">¿Quién recibió el pago?</p>
                  <NativeSelect
                    value={payForm.paid_by_id}
                    onChange={e => setPayForm(p => ({ ...p, paid_by_id: e.target.value }))}
                    placeholder="Sin especificar"
                    options={[{ value: '', label: 'Sin especificar' }, ...persons.map(p => ({ value: p.id, label: p.name }))]}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Método de pago</p>
                  <NativeSelect
                    value={payForm.payment_method_id}
                    onChange={e => setPayForm(p => ({ ...p, payment_method_id: e.target.value }))}
                    placeholder="Sin especificar"
                    options={[{ value: '', label: 'Sin especificar' }, ...paymentMethods.map(m => ({ value: m.id, label: m.name }))]}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notas (opcional)</p>
                  <input placeholder="Referencia, observaciones..."
                    value={payForm.notes}
                    onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>

                <button
                  onClick={handleConfirmPayment}
                  disabled={isSavingPayment || !payForm.amount}
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

      {/* ── Create / Edit property bottom sheet ──────────────────────────── */}
      <AnimatePresence>
        {showPropForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => { if (!savePropMutation.isPending) { setShowPropForm(false); setEditingProp(null); } }}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-[51] bg-card rounded-t-3xl border-t border-border flex flex-col"
              style={{ maxHeight: '90vh', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
            >
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3 flex-shrink-0" />
              <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
                <h3 className="font-bold text-foreground">{editingProp ? 'Editar Propiedad' : 'Nueva Propiedad'}</h3>
                <button
                  onClick={() => { setShowPropForm(false); setEditingProp(null); }}
                  className="p-1.5 rounded-lg bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto overscroll-none hide-scrollbar flex-1 px-5 py-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Nombre de la propiedad *</p>
                  <input
                    placeholder="Ej: Depto Norte, Casa Toche"
                    value={propForm.name}
                    onChange={e => setPropForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Inquilino</p>
                  <input
                    placeholder="Nombre del inquilino"
                    value={propForm.tenant_name}
                    onChange={e => setPropForm(f => ({ ...f, tenant_name: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Dirección</p>
                  <input
                    placeholder="Calle, colonia, ciudad"
                    value={propForm.address}
                    onChange={e => setPropForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Renta base mensual *</p>
                    <input
                      type="number" inputMode="decimal"
                      placeholder="0.00"
                      value={propForm.base_rent}
                      onChange={e => setPropForm(f => ({ ...f, base_rent: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Día de cobro (1–28)</p>
                    <input
                      type="number" min="1" max="28"
                      placeholder="Ej: 5"
                      value={propForm.payment_day}
                      onChange={e => setPropForm(f => ({ ...f, payment_day: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notas</p>
                  <input
                    placeholder="Observaciones adicionales"
                    value={propForm.notes}
                    onChange={e => setPropForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <button
                  onClick={handleSaveProp}
                  disabled={!propForm.name.trim() || !propForm.base_rent || savePropMutation.isPending}
                  className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 active:opacity-80 min-h-[48px] flex items-center justify-center gap-2"
                >
                  {savePropMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                    : editingProp ? 'Guardar cambios' : 'Crear Propiedad'
                  }
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}