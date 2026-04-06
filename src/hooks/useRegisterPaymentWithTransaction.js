import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';

function getWeekNumber(dateStr) {
  try {
    const date = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  } catch {
    return 1;
  }
}

/**
 * Saves the primary record AND a matching Transaction entry so it appears in Movimientos.
 * Usage:
 *   const registerPayment = useRegisterPaymentWithTransaction();
 *   await registerPayment(
 *     () => base44.entities.ScheduledPaymentRecord.create(data),
 *     { amount, date, description, category_id, payment_method_id, person_id }
 *   );
 */
export function useRegisterPaymentWithTransaction() {
  const queryClient = useQueryClient();
  const { familyId } = useFamily();

  return async function registerPayment(primarySaveFn, txFields) {
    const {
      amount,
      date,
      description,
      category_id,
      payment_method_id,
      person_id,
      type = 'expense',
    } = txFields;

    // 1. Always save the primary record first
    const primaryResult = await primarySaveFn();

    // 2. Create a Transaction only if required fields are present
    if (category_id && person_id) {
      const week = getWeekNumber(date);
      await base44.entities.Transaction.create({
        family_id: familyId,
        date,
        type,
        amount: parseFloat(amount) || 0,
        description: description || '',
        category_id,
        payment_method_id: payment_method_id || undefined,
        person_id,
        required_type: type === 'income' ? 'Otro' : 'Necesario',
        week,
        scheduled_payment_record_id: primaryResult?.id || undefined,
      });
    }

    // 3. Refresh relevant queries so Dashboard/Movimientos update
    queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
    queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });

    return primaryResult;
  };
}