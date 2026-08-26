import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { guardedCreate, guardedUpdate } from '@/lib/guardedWrite';
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

const DEFAULT_MATCHING_TOLERANCE_DAYS = 2;
const DEFAULT_MATCHING_TOLERANCE_AMOUNT = 0.01;

function daysBetweenISO(a, b) {
  const aDate = new Date(`${a}T12:00:00`);
  const bDate = new Date(`${b}T12:00:00`);
  if (Number.isNaN(aDate.getTime()) || Number.isNaN(bDate.getTime())) return Number.POSITIVE_INFINITY;
  return Math.abs((aDate.getTime() - bDate.getTime()) / 86400000);
}

export function matchesScheduledPaymentTransactionRule(transaction, rule) {
  if (!transaction || !rule) return false;
  if (!rule.family_id || transaction.family_id !== rule.family_id) return false;
  if (!rule.scheduled_payment_id || transaction.scheduled_payment_id !== rule.scheduled_payment_id) return false;

  const dateDelta = daysBetweenISO(transaction.date, rule.date);
  if (dateDelta > rule.tolerance_days) return false;

  const amountDelta = Math.abs((parseFloat(transaction.amount) || 0) - (parseFloat(rule.amount) || 0));
  if (amountDelta > rule.tolerance_amount) return false;

  return true;
}

export async function findMatchingScheduledPaymentTransaction({
  family_id,
  scheduled_payment_record_id,
  scheduled_payment_id,
  date,
  amount,
  tolerance_days = DEFAULT_MATCHING_TOLERANCE_DAYS,
  tolerance_amount = DEFAULT_MATCHING_TOLERANCE_AMOUNT,
}) {
  if (scheduled_payment_record_id) {
    const linked = await base44.entities.Transaction.filter({ scheduled_payment_record_id });
    if (linked?.[0]) return linked[0];
  }

  if (!family_id || !scheduled_payment_id || !date) return null;
  const candidates = await base44.entities.Transaction.filter({ family_id, scheduled_payment_id });
  return (candidates || []).find((tx) => matchesScheduledPaymentTransactionRule(tx, {
    family_id,
    scheduled_payment_id,
    date,
    amount,
    tolerance_days,
    tolerance_amount,
  })) || null;
}

/**
 * Saves the primary record AND a matching Transaction entry so it appears in Movimientos.
 * Usage:
 *   const registerPayment = useRegisterPaymentWithTransaction();
 *   await registerPayment(
 *     () => guardedCreate('ScheduledPaymentRecord', data),
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

    // Which Transaction column points back at the row we just created. This used to
    // be "primaryResult.id unless a rental_payment_id was passed", which quietly
    // stamped an MSIPayment id into scheduled_payment_record_id for the MSI flow.
    // A ScheduledPaymentRecord identifies itself by carrying scheduled_payment_id;
    // every other caller has to name its column explicitly.
    const linkField = txFields.link_field_from_primary
      || (primaryResult?.scheduled_payment_id ? 'scheduled_payment_record_id' : undefined);
    const scheduledPaymentRecordId = txFields.scheduled_payment_record_id
      || (linkField === 'scheduled_payment_record_id' ? primaryResult?.id : undefined);
    const primaryLink = linkField && linkField !== 'scheduled_payment_record_id' && primaryResult?.id
      ? { [linkField]: primaryResult.id }
      : {};
    const matchingTx = await findMatchingScheduledPaymentTransaction({
      family_id: familyId,
      scheduled_payment_record_id: scheduledPaymentRecordId,
      scheduled_payment_id: txFields.scheduled_payment_id || primaryResult?.scheduled_payment_id,
      date,
      amount,
      tolerance_days: txFields.matching_tolerance_days,
      tolerance_amount: txFields.matching_tolerance_amount,
    });

    if (matchingTx && primaryResult?.id) {
      const updates = {
        scheduled_payment_record_id: scheduledPaymentRecordId,
      };
      if (matchingTx.status !== 'reconciled') updates.status = 'reconciled';
      await guardedUpdate('Transaction', matchingTx.id, updates);
      if (primaryResult?.scheduled_payment_id) {
        await guardedUpdate('ScheduledPaymentRecord', primaryResult.id, { linked_transaction_id: matchingTx.id, status: 'reconciled' });
      }
    }

    // 2. Create a Transaction only if required fields are present
    if (!matchingTx && category_id && person_id) {
      const week = getWeekNumber(date);
      const txResult = await guardedCreate('Transaction', {
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
        scheduled_payment_record_id: scheduledPaymentRecordId,
        rental_payment_id: txFields.rental_payment_id || undefined,
        scheduled_payment_id: txFields.scheduled_payment_id || primaryResult?.scheduled_payment_id,
        ...primaryLink,
      });

      if (primaryResult?.id && txResult?.id && primaryResult?.scheduled_payment_id) {
        await guardedUpdate('ScheduledPaymentRecord', primaryResult.id, { linked_transaction_id: txResult.id });
      }
    }

    // 3. Refresh relevant queries so Dashboard/Movimientos update
    queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
    queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });

    return primaryResult;
  };
}
