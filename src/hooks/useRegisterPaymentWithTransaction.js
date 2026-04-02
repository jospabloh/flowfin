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
    } = txFields;

    const week = getWeekNumber(date);

    // Fire both writes in parallel
    await Promise.all([
      primarySaveFn(),
      base44.entities.Transaction.create({
        family_id: familyId,
        date,
        type: 'expense',
        amount: parseFloat(amount) || 0,
        description: description || '',
        category_id: category_id || undefined,
        payment_method_id: payment_method_id || undefined,
        person_id: person_id || undefined,
        required_type: 'Necesario',
        week,
      }),
    ]);

    // Invalidate transactions so Dashboard/Movimientos refresh
    queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
    queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });
  };
}