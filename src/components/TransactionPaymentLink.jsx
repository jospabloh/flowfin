import { Link as LinkIcon, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function TransactionPaymentLink({ transaction, onUnlink }) {
  const queryClient = useQueryClient();
  
  const unlinkMutation = useMutation({
    mutationFn: async (fieldName) => {
      return await base44.entities.Transaction.update(transaction.id, { [fieldName]: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onUnlink?.();
    },
  });

  const getLinkedPaymentInfo = () => {
    if (transaction.msi_payment_id) {
      return { type: 'MSI', id: transaction.msi_payment_id, field: 'msi_payment_id', icon: '💳' };
    }
    if (transaction.investment_payment_id) {
      return { type: 'Inversión', id: transaction.investment_payment_id, field: 'investment_payment_id', icon: '💰' };
    }
    if (transaction.scheduled_payment_record_id) {
      return { type: 'Pago Programado', id: transaction.scheduled_payment_record_id, field: 'scheduled_payment_record_id', icon: '📅' };
    }
    if (transaction.rental_payment_id) {
      return { type: 'Renta', id: transaction.rental_payment_id, field: 'rental_payment_id', icon: '🏠' };
    }
    return null;
  };

  const linkedPayment = getLinkedPaymentInfo();

  if (!linkedPayment) return null;

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
      <LinkIcon className="w-3.5 h-3.5 text-primary" />
      <span className="text-xs font-semibold text-primary">
        {linkedPayment.icon} {linkedPayment.type}
      </span>
      <button
        onClick={() => unlinkMutation.mutate(linkedPayment.field)}
        disabled={unlinkMutation.isPending}
        className="ml-1 p-0.5 hover:bg-primary/20 rounded transition-colors"
        title="Desvinc ular"
      >
        <X className="w-3 h-3 text-primary" />
      </button>
    </div>
  );
}