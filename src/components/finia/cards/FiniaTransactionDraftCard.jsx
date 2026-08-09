import FiniaTicketCard from './FiniaTicketCard';
import { parseCardAmount, formatCardAmount } from '@/lib/finiaAmount';

// Finia lays out a draft the same way a receipt does: a total, an item, and
// a ledger of line items underneath. Rendering it as an actual ticket stub
// (see .finia-ticket / --receipt-* tokens in index.css, and FiniaTicketCard
// for the shared shell) makes the one message in the whole chat that's
// about to become a real record look like one — instead of blending into
// another dark bubble.
const LEDGER_ROWS = [
  { key: 'category', label: 'Rubro' },
  { key: 'subcategory', label: 'Subrubro' },
  { key: 'person', label: 'Persona' },
  { key: 'paymentMethod', label: 'Forma de pago' },
  { key: 'date', label: 'Fecha' },
];

// Same canned-reply phrasing the agent already expects back (see
// finiaCardParser.js / the old DRAFT_CHIPS) — these are effectively typed
// buttons, not free-text guesses.
const EDIT_ACTIONS = [
  { key: 'amount', label: 'Cambiar monto', text: 'Quiero cambiar el monto' },
  { key: 'category', label: 'Cambiar rubro', text: 'Quiero cambiar el rubro' },
  { key: 'person', label: 'Cambiar persona', text: 'Quiero cambiar la persona' },
];

export default function FiniaTransactionDraftCard({ fields, note, onAction, disabled }) {
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
          {isIncome ? 'Ingreso' : 'Gasto'}
        </span>
      }
      amountLabel={amount ? `$${formatCardAmount(amount)}` : fields.amount}
      amountColorVar={inkVar}
      titleLine={fields.concept}
      ledgerRows={ledgerRows}
      note={note}
      editActions={EDIT_ACTIONS}
      onAction={onAction}
      disabled={disabled}
    />
  );
}
