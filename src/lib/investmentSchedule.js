import { addMonths, parseISO } from 'date-fns';

// El calendario de una inversión se DERIVA del Investment (start_date +
// payment_day + total_payments); no se guarda. Una fila de InvestmentPayment
// es una cuota **confirmada**, igual que MSIPayment y ScheduledPaymentRecord.
//
// Estas dos funciones estaban copiadas en cuatro lugares (tarjeta, hoja de
// detalle, página de Inversiones y dashboard) y la copia contaba como pagada
// toda fila con `date <= hoy`. Eso convertía un calendario sembrado por
// adelantado en un reloj: LOCAL 09 ALBASERRADA tenía sus 18 cuotas creadas
// desde marzo de 2026 con notas "pendiente", y cada una se daba por
// registrada sola el día que le llegaba su fecha — sin que nadie la
// confirmara y sin movimiento en Movimientos. Viven aquí para que el criterio
// no vuelva a divergir entre pantallas.

export function countPaidInstallments(payments, investmentId) {
  return payments.filter(p => p.investment_id === investmentId).length;
}

// Devuelve la siguiente cuota por pagar, o null si la inversión ya está
// completa. `diff` es la distancia en días hasta el vencimiento (negativo =
// vencida), que es lo que las pantallas usan para el color y la etiqueta.
export function getNextInstallment(inv, paidCount, now = new Date()) {
  if (!inv?.start_date || !inv?.total_payments) return null;
  if (paidCount >= inv.total_payments) return null;
  const date = addMonths(parseISO(inv.start_date), paidCount);
  if (inv.payment_day) date.setDate(Math.min(inv.payment_day, 28));
  return {
    number: paidCount + 1,
    date,
    diff: Math.ceil((date - now) / 86400000),
    remaining: inv.total_payments - paidCount,
  };
}
