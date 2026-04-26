import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useFamily } from '@/lib/FamilyContext';
import { X, Plus } from 'lucide-react';
import { createFocusTrap } from '@/lib/focusTrap';
import NativeSelect from '@/components/NativeSelect';
import TransactionPaymentLink from '@/components/TransactionPaymentLink';
import ApplyPaymentModal from '@/components/ApplyPaymentModal';
import { useBottomSheetStyle } from '@/hooks/useBottomSheetStyle';
import { usePermission } from '@/lib/permissions/usePermission';

const REQUIRED_TYPES = ['Necesario', 'Gusto', 'Urgente', 'Inversión', 'Otro'];

export default function TransactionEditModal({ transaction, categories, subcategories, persons, paymentMethods, onClose, onSaved }) {
  const modalRef = useRef(null);
  const [form, setForm] = useState({
    date: transaction.date || '',
    type: transaction.type || 'expense',
    amount: transaction.amount || '',
    description: transaction.description || '',
    category_id: transaction.category_id || '',
    subcategory_id: transaction.subcategory_id || '',
    person_id: transaction.person_id || '',
    payment_method_id: transaction.payment_method_id || '',
    required_type: transaction.required_type || 'Necesario',
    has_invoice: transaction.has_invoice || false,
    notes: transaction.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [showApplyPayment, setShowApplyPayment] = useState(false);
  const [txData, setTxData] = useState(transaction);
  const queryClient = useQueryClient();
  const { familyId } = useFamily();
  const { can_modify: canEditAmount }       = usePermission('transaction.fields.amount.edit');
  const { can_modify: canEditDate }         = usePermission('transaction.fields.date.edit');
  const { can_modify: canEditCategory }     = usePermission('transaction.fields.category.edit');
  const { can_modify: canEditPerson }       = usePermission('transaction.fields.person.edit');
  const { can_modify: canEditPaymentMethod }= usePermission('transaction.fields.payment_method.edit');
  const { can_modify: canEditDescription }  = usePermission('transaction.fields.description.edit');
  const { can_modify: canToggleInvoice }    = usePermission('transaction.fields.invoice.toggle');

  useEffect(() => {
    if (!modalRef.current) return;
    const cleanup = createFocusTrap(modalRef);
    return cleanup;
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Transaction.update(id, data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });
    },
  });

  const handleSave = () => {
    if (!form.amount) return;
    setSaving(true);
    const data = { ...form, amount: parseFloat(form.amount) };
    updateMutation.mutate(
      { id: transaction.id, data },
      {
        onSettled: () => {
          setSaving(false);
          onSaved?.();
          onClose();
        },
      }
    );
  };

  const handlePaymentLinked = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
    setTxData(prev => ({ ...prev }));
  };

  const filteredSubs = subcategories.filter(s => s.category_id === form.category_id);
  const sheetStyle = useBottomSheetStyle(0.92);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet — sits above bottom nav bar */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="fixed left-0 right-0 bottom-0 z-50 w-full bg-card rounded-t-3xl shadow-2xl flex flex-col"
        style={sheetStyle}
        onClick={e => e.stopPropagation()}
      >
        {/* Header — sticky */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border flex-shrink-0">
          <h2 id="modal-title" className="text-base font-bold text-foreground">Editar movimiento</h2>
          <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-xl hover:bg-muted transition-colors touch-target">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 overflow-y-auto overscroll-none hide-scrollbar px-5 py-4 space-y-3"
          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
        >
          {/* Type */}
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            {[{ key: 'expense', label: '💸 Egreso' }, { key: 'income', label: '💰 Ingreso' }].map(t => (
              <button key={t.key} onClick={() => set('type', t.key)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all
                  ${form.type === t.key ? (t.key === 'expense' ? 'bg-expense text-white' : 'bg-income text-white') : 'text-muted-foreground'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Monto</label>
            <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
              disabled={!canEditAmount}
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Descripción</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
              disabled={!canEditDescription}
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>

          {/* Date */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fecha</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              disabled={!canEditDate}
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>

          {/* Category + Subcategory */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rubro</label>
              <NativeSelect
                value={form.category_id}
                onChange={e => { set('category_id', e.target.value); set('subcategory_id', ''); }}
                placeholder="— Rubro"
                options={categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
                disabled={!canEditCategory}
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">SubRubro</label>
              <NativeSelect
                value={form.subcategory_id}
                onChange={e => set('subcategory_id', e.target.value)}
                placeholder="— Sub"
                options={filteredSubs.map(s => ({ value: s.id, label: s.name }))}
                disabled={!canEditCategory}
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Person */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Persona</label>
            <NativeSelect
              value={form.person_id}
              onChange={e => set('person_id', e.target.value)}
              placeholder="— Persona"
              options={persons.map(p => ({ value: p.id, label: p.name }))}
              disabled={!canEditPerson}
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Payment method */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {form.type === 'income' ? 'Cuenta / Origen del ingreso' : 'Forma de pago'}
            </label>
            <NativeSelect
              value={form.payment_method_id}
              onChange={e => set('payment_method_id', e.target.value)}
              placeholder={form.type === 'income' ? '— Cuenta / Origen' : '— Forma'}
              options={paymentMethods.map(m => ({ value: m.id, label: m.name }))}
              disabled={!canEditPaymentMethod}
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Required type */}
          {form.type === 'expense' && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Clasificación</label>
              <NativeSelect
                value={form.required_type}
                onChange={e => set('required_type', e.target.value)}
                placeholder="Clasificación"
                options={REQUIRED_TYPES.map(r => ({ value: r, label: r }))}
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notas</label>
            <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Opcional"
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Linked payment */}
          {(txData.msi_payment_id || txData.investment_payment_id || txData.scheduled_payment_record_id || txData.rental_payment_id) && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
              <TransactionPaymentLink transaction={txData} onUnlink={handlePaymentLinked} />
            </div>
          )}

          {/* Apply payment button */}
          {form.type === 'expense' && (
            <button
              onClick={() => setShowApplyPayment(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition-colors touch-target"
            >
              <Plus className="w-4 h-4" />
              Aplicar a pago especializado
            </button>
          )}

          {/* Save — extra bottom padding so it clears the safe area + nav bar */}
          <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
            <button onClick={handleSave} disabled={saving || !form.amount}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 disabled:opacity-50 transition-all touch-target">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      {/* Apply Payment Modal */}
      {showApplyPayment && (
        <ApplyPaymentModal
          transaction={txData}
          familyId={familyId}
          onClose={() => setShowApplyPayment(false)}
          onSuccess={handlePaymentLinked}
        />
      )}
    </>
  );
}