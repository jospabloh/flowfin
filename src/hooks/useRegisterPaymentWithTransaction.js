import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { getWeekNumber } from '@/lib/categoryMatcher';

/**
 * Returns a helper that fires TWO parallel writes:
 *   1. The entity-specific save (e.g. InvestmentPayment, MSIPayment, ScheduledPaymentRecord)
 *   2. A Transaction record (expense) so the payment appears in Movimientos
 *
 * Usage:
 *   const registerPayment = useRegisterPaymentWithTransaction();
 *   await registerPayment(
 *     () => base44.entities.InvestmentPayment.create(data),   // primary save fn
 *     { amount, date, description, category_id, payment_method_id, person_id }  // tx fields
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

    const week = getWeekNumber(date);

    // Always save the primary record first
    const primaryResult = await primarySaveFn();

    // Only create a Transaction if we have the required fields (category_id and person_id)
    if (category_id && person_id) {
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

    return primaryResult;

    // Invalidate transactions so Dashboard/Movimientos refresh
    queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
    queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });
  };
}