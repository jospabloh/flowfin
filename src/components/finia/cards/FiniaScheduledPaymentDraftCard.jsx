import FiniaTicketCard from './FiniaTicketCard';
import { parseCardAmount, formatCardAmount } from '@/lib/finiaAmount';

// Recurring-charge draft (rent, subscription, utility bill) — visually the
// same "receipt" system as the one-off transaction draft (FiniaTicketCard),
// distinguished by a "/mes" suffix on the amount instead of a second badge:
// the recurrence is the one thing worth calling out, so it earns the
// signature spot next to the number itself rather than competing for
// attention with its own pill.
const LEDGER_ROWS = [
  { key: 'dueDay', label: 'Vence' },
  { key: 'category', label: 'Rubro' },
  { key: 'person', label: 'Persona' },
  { key: 'paymentMethod', label: 'Forma de pago' },
];

const EDIT_ACTIONS = [
  { key: 'amount', label: 'Cambiar monto', text: 'Quiero cambiar el monto' },
  { key: 'dueDay', label: 'Cambiar día', text: 'Quiero cambiar el día de vencimiento' },
  { key: 'category', label: 'Cambiar rubro', text: 'Quiero cambiar el rubro' },
  { key: 'person', label: 'Cambiar persona', text: 'Quiero cambiar la persona' },
];

export default function FiniaScheduledPaymentDraftCard({ fields, note, onAction, disabled }) {
  const isIncome = /ingreso/i.test(fields.type || '');
  const amount = parseCardAmount(fields.amount);
  const inkVar = isIncome ? 'hsl(var(--receipt-income))' : 'hsl(var(--receipt-expense))';
  const ledgerRows = LEDGER_ROWS
    .filter(({ key }) => fields[key])
    .map(row => ({ ...row, value: fields[row.key] }));

  return (
    <FiniaTicketCard
      eyebrow="Borrador"
      badge={
        <span
          className="text-[10px] font-bold uppercase tracking-[0.07em] px-2 py-0.5 rounded-full"
          style={{ color: inkVar, backgroundColor: `hsl(var(--receipt-${isIncome ? 'income' : 'expense'}) / 0.1)` }}
        >
          {isIncome ? 'Cobro recurrente' : 'Cargo recurrente'}
        </span>
      }
      amountLabel={
        <>
          {amount != null ? `$${formatCardAmount(amount)}` : (fields.amount || '—')}
          <span className="text-[15px] font-semibold align-baseline" style={{ color: 'hsl(var(--receipt-ink-muted))' }}> /mes</span>
        </>
      }
      amountColorVar={inkVar}
      titleLine={fields.name}
      ledgerRows={ledgerRows}
      note={note}
      editActions={EDIT_ACTIONS}
      onAction={onAction}
      disabled={disabled}
    />
  );
}
