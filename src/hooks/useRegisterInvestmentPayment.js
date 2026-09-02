import { useCallback } from 'react';
import { guardedCreate, guardedDelete } from '@/lib/guardedWrite';

function isoWeek(dateStr) {
  try {
    const date = new Date(dateStr + 'T12:00:00');
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  } catch { return 1; }
}

// Confirmar una cuota de inversión = crear la fila de InvestmentPayment Y su
// movimiento. Vive en un hook porque ahora hay dos pantallas que lo hacen
// (Inversiones y Pagos del Mes) y las dos tienen que escribir exactamente el
// mismo par; una segunda copia es justo cómo se separan.
export function useRegisterInvestmentPayment() {
  return useCallback(async ({ investment, familyId, paymentNumber, form }) => {
    const payData = {
      investment_id: investment.id,
      family_id: investment.family_id || familyId,
      payment_number: paymentNumber,
      amount: +form.amount,
      date: form.date,
      notes: form.notes,
    };
    let savedPayment;
    try {
      savedPayment = await guardedCreate('InvestmentPayment', payData);
      if (form.category_id && form.person_id) {
        await guardedCreate('Transaction', {
          family_id: familyId,
          date: form.date,
          type: 'expense',
          amount: +form.amount,
          description: `Inversión: ${investment.name} — Pago #${paymentNumber}${form.notes ? ` — ${form.notes}` : ''}`,
          category_id: form.category_id,
          payment_method_id: form.payment_method_id || undefined,
          person_id: form.person_id,
          required_type: 'Inversión',
          week: isoWeek(form.date),
          investment_payment_id: savedPayment.id,
        });
      }
    } catch (error) {
      // InvestmentPayment.create can succeed while the follow-up Transaction.create
      // throws (network blip, RLS rejection). Left alone, that orphans a payment
      // that shows as registered in Historial de pagos with nothing in Movimientos —
      // the entity hook backstop (createTransactionFromInvestmentPayment) can't help
      // here either, since InvestmentPayment doesn't store category_id/person_id for
      // it to resolve. Roll back the payment and let the caller surface the failure.
      if (savedPayment?.id) {
        try { await guardedDelete('InvestmentPayment', savedPayment.id); } catch { /* best-effort rollback */ }
      }
      throw error;
    }
    return savedPayment;
  }, []);
}
