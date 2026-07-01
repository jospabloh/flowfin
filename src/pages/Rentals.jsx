import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus } from 'lucide-react';
import Spinner from '@/components/Spinner';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { useFamily } from '@/lib/FamilyContext';
import { useToast } from '@/components/ui/use-toast';
import confetti from 'canvas-confetti';
import RentalPropertyCard from '@/components/rentals/RentalPropertyCard';
import RentalPaymentSheet from '@/components/rentals/RentalPaymentSheet';
import RentalPropertyFormSheet from '@/components/rentals/RentalPropertyFormSheet';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm.jsx';
import { usePermission } from '@/lib/permissions/usePermission';
import { useFeatureGate } from '@/lib/permissions/useFeatureGate';
import PaywallPrompt from '@/components/billing/PaywallPrompt';

const TODAY_ISO = new Date().toISOString().slice(0, 10);
const THIS_MONTH = new Date().toISOString().slice(0, 7);
const EMPTY_PROP_FORM = { name: '', address: '', tenant_name: '', base_rent: '', payment_day: '', notes: '' };

export default function Rentals() {
  const queryClient = useQueryClient();
  const { familyId } = useFamily();
  const { toast } = useToast();
  const { confirmDelete, ConfirmDialog } = useDeleteConfirm();
  const { can_write: canCreate }       = usePermission('rental.property.create');
  const gate = useFeatureGate('page.Rentals');

  const [showPropForm, setShowPropForm] = useState(false);
  const [editingProp, setEditingProp] = useState(null);
  const [propForm, setPropForm] = useState(EMPTY_PROP_FORM);
  const [showPayForm, setShowPayForm] = useState(false);
  const [selectedProp, setSelectedProp] = useState(null);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [unmarkingId, setUnmarkingId] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', month: THIS_MONTH, paid_by_id: '', payment_method_id: '', date_paid: TODAY_ISO, notes: '' });

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

  const savePropMutation = useMutation({
    mutationFn: (data) => editingProp ? base44.entities.RentalProperty.update(editingProp.id, data) : base44.entities.RentalProperty.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentalProperties', familyId] });
      setShowPropForm(false); setEditingProp(null); setPropForm(EMPTY_PROP_FORM);
      toast({ title: editingProp ? '✅ Propiedad actualizada' : '✅ Propiedad creada', duration: 3000 });
    },
    onError: (err) => toast({ title: 'Error', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' }),
  });

  const deletePropMutation = useMutation({
    mutationFn: (id) => base44.entities.RentalProperty.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rentalProperties', familyId] }); toast({ title: '🗑️ Propiedad eliminada', duration: 3000 }); },
    onError: (err) => toast({ title: 'Error al eliminar', description: err?.message, variant: 'destructive' }),
  });

  function openNewProp() { setEditingProp(null); setPropForm(EMPTY_PROP_FORM); setShowPropForm(true); }
  function openEditProp(prop) {
    setEditingProp(prop);
    setPropForm({ name: prop.name || '', address: prop.address || '', tenant_name: prop.tenant_name || '', base_rent: prop.base_rent != null ? String(prop.base_rent) : '', payment_day: prop.payment_day != null ? String(prop.payment_day) : '', notes: prop.notes || '' });
    setShowPropForm(true);
  }
  async function handleDeleteProp(prop) {
    if (await confirmDelete(`¿Eliminar la propiedad "${prop.name}"? Esta acción no se puede deshacer.`)) {
      deletePropMutation.mutate(prop.id);
    }
  }
  function handleSaveProp() {
    if (!propForm.name.trim() || !propForm.base_rent) return;
    savePropMutation.mutate({ family_id: familyId, name: propForm.name.trim(), address: propForm.address.trim() || undefined, tenant_name: propForm.tenant_name.trim() || undefined, base_rent: parseFloat(propForm.base_rent) || 0, payment_day: propForm.payment_day ? parseInt(propForm.payment_day) : undefined, notes: propForm.notes.trim() || undefined, is_active: true });
  }
  function openPayForm(prop) {
    setSelectedProp(prop);
    setPayForm({ amount: prop.base_rent ? String(prop.base_rent) : '', month: THIS_MONTH, paid_by_id: persons[0]?.id || '', payment_method_id: '', date_paid: TODAY_ISO, notes: '' });
    setShowPayForm(true);
  }

  async function handleConfirmPayment() {
    if (!selectedProp || isSavingPayment) return;
    setIsSavingPayment(true);
    try {
      const res = await base44.functions.invoke('payments', { action: 'registerRentalPaymentSafe',
        property_id: selectedProp.id, month: payForm.month, amount: parseFloat(payForm.amount) || selectedProp.base_rent || 0,
        paid_by_id: payForm.paid_by_id || undefined, payment_method_id: payForm.payment_method_id || undefined,
        date_paid: payForm.date_paid, notes: payForm.notes || undefined,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries({ queryKey: ['rentalPayments', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });
      confetti({ particleCount: 90, spread: 65, origin: { y: 0.7 }, colors: ['#059669', '#10B981', '#6EE7B7'] });
      toast({ title: '✅ Cobro registrado', description: 'Ingreso registrado correctamente en Movimientos.', duration: 5000 });
      setShowPayForm(false);
    } catch (error) {
      toast({ title: 'Error al registrar cobro', description: error?.message || 'Intenta de nuevo.', variant: 'destructive', duration: 5000 });
    } finally {
      setIsSavingPayment(false);
    }
  }

  async function handleUnmark(prop, payRecord) {
    if (unmarkingId) return;
    if (!await confirmDelete(`¿Desmarcar el cobro de ${payRecord.month} para "${prop.name}"? Se eliminará el ingreso vinculado.`)) return;
    setUnmarkingId(payRecord.id);
    try {
      const linked = await base44.entities.Transaction.filter({ rental_payment_id: payRecord.id });
      for (const tx of linked) await base44.entities.Transaction.delete(tx.id);
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

  if (gate.status === 'loading') {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (gate.status === 'denied') {
    return (
      <div className="pb-24">
        <PageHeader title="Rentas" subtitle="Cobro de propiedades" />
        <PaywallPrompt feature="page.Rentals" requiredPlan={gate.requiredPlan} />
      </div>
    );
  }

  return (
    <div className="pb-24">
      <ConfirmDialog />
      <PageHeader title="Rentas" subtitle="Cobro de propiedades"
        action={canCreate ? <button onClick={openNewProp} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> Nueva</button> : null} />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : properties.length === 0 ? (
        <EmptyState icon="🏠" title="Sin propiedades" description="Registra tus inmuebles para darles seguimiento de cobro" />
      ) : (
        <div className="px-4 space-y-3">
          {properties.map(prop => (
            <RentalPropertyCard key={prop.id} prop={prop} rentalPayments={rentalPayments} unmarkingId={unmarkingId}
              deleteMutationPending={deletePropMutation.isPending} onEdit={openEditProp} onDelete={handleDeleteProp} onPay={openPayForm} onUnmark={handleUnmark} />
          ))}
        </div>
      )}

      <RentalPaymentSheet show={showPayForm} prop={selectedProp} payForm={payForm} setPayForm={setPayForm}
        persons={persons} paymentMethods={paymentMethods} isSaving={isSavingPayment}
        onConfirm={handleConfirmPayment} onClose={() => setShowPayForm(false)} />

      <RentalPropertyFormSheet show={showPropForm} editingProp={editingProp} propForm={propForm} setPropForm={setPropForm}
        isSaving={savePropMutation.isPending} onSave={handleSaveProp} onClose={() => { setShowPropForm(false); setEditingProp(null); }} />
    </div>
  );
}
