import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import NativeSelect from '@/components/NativeSelect';
import { useBottomSheetStyle } from '@/hooks/useBottomSheetStyle';

export default function ApplyPaymentModal({ transaction, familyId, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const sheetStyle = useBottomSheetStyle(0.90);
  const [paymentType, setPaymentType] = useState('msi');
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: msiPayments = [] } = useQuery({
    queryKey: ['msiPayments', familyId],
    queryFn: () => base44.entities.MSIPayment.filter({ msi_id: { $exists: true } }, '-paid_date', 100),
    enabled: paymentType === 'msi',
  });

  const { data: investmentPayments = [] } = useQuery({
    queryKey: ['investmentPayments', familyId],
    queryFn: () => base44.entities.InvestmentPayment.filter({ investment_id: { $exists: true } }, '-date', 100),
    enabled: paymentType === 'investment',
  });

  const { data: scheduledPaymentRecords = [] } = useQuery({
    queryKey: ['scheduledPaymentRecords', familyId],
    queryFn: () => base44.entities.ScheduledPaymentRecord.filter({ family_id: familyId }, '-paid_date', 100),
    enabled: paymentType === 'scheduled_payment',
  });

  const { data: rentalPayments = [] } = useQuery({
    queryKey: ['rentalPayments', familyId],
    queryFn: () => base44.entities.RentalPayment.filter({ property_id: { $exists: true } }, '-date_paid', 100),
    enabled: paymentType === 'rental',
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      return await base44.functions.invoke('linkTransactionToPayment', {
        transaction_id: transaction.id,
        payment_type: paymentType,
        payment_id: selectedPaymentId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onSuccess?.();
      onClose();
    },
  });

  const getPaymentsList = () => {
    let list = [];
    if (paymentType === 'msi') list = msiPayments;
    else if (paymentType === 'investment') list = investmentPayments;
    else if (paymentType === 'scheduled_payment') list = scheduledPaymentRecords;
    else if (paymentType === 'rental') list = rentalPayments;
    
    return list.filter(p => {
      const text = JSON.stringify(p).toLowerCase();
      return text.includes(searchTerm.toLowerCase());
    });
  };

  const paymentsList = getPaymentsList();

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border overflow-y-auto"
        style={sheetStyle}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card p-4 border-b border-border flex items-center justify-between z-10">
          <h3 className="font-bold text-foreground">Vincular pago especializado</h3>
          <button onClick={onClose} className="p-2 rounded-lg bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Payment type selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">Tipo de pago</label>
            <NativeSelect
              value={paymentType}
              onChange={e => { setPaymentType(e.target.value); setSelectedPaymentId(''); setSearchTerm(''); }}
              options={[
                { value: 'msi', label: '💳 MSI' },
                { value: 'investment', label: '💰 Inversión' },
                { value: 'scheduled_payment', label: '📅 Pago Programado' },
                { value: 'rental', label: '🏠 Renta' },
              ]}
              className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm"
            />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar pago..."
              className="w-full pl-9 pr-4 py-2.5 bg-muted border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Payments list */}
          <div className="max-h-48 overflow-y-auto space-y-2">
            {paymentsList.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sin pagos disponibles</p>
            ) : (
              paymentsList.map((payment, i) => {
                const label = paymentType === 'msi'
                  ? `${payment.month_number} - $${payment.amount}`
                  : paymentType === 'investment'
                  ? `Cuota ${payment.payment_number} - $${payment.amount}`
                  : paymentType === 'scheduled_payment'
                  ? `${payment.month} - $${payment.amount_paid}`
                  : `${payment.month} - $${payment.amount}`;

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedPaymentId(payment.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      selectedPaymentId === payment.id
                        ? 'bg-primary/10 border-primary text-foreground'
                        : 'bg-muted border-border text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    <p className="text-sm font-medium">{label}</p>
                  </button>
                );
              })
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-4 border-t border-border">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => linkMutation.mutate()}
              disabled={!selectedPaymentId || linkMutation.isPending}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {linkMutation.isPending ? 'Vinculando...' : 'Vincular'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}