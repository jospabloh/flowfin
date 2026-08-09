import { Scissors } from 'lucide-react';
import FiniaTicketCard from './FiniaTicketCard';
import { parseCardAmount, formatCardAmount } from '@/lib/finiaAmount';

// One receipt, torn into stubs — the visual metaphor for "this one purchase
// becomes several movements". Shares FiniaTicketCard's shell (same paper,
// same ledger) for the fields every draft has in common, then adds a
// perforated "cut here" band with one stub per person underneath — reusing
// the receipt's own dashed-rule language instead of inventing a new one.
const LEDGER_ROWS = [
  { key: 'category', label: 'Rubro' },
  { key: 'subcategory', label: 'Subrubro' },
  { key: 'paymentMethod', label: 'Forma de pago' },
  { key: 'date', label: 'Fecha' },
];

const EDIT_ACTIONS = [
  { key: 'amounts', label: 'Cambiar montos', text: 'Quiero cambiar cómo se reparte el monto' },
  { key: 'category', label: 'Cambiar rubro', text: 'Quiero cambiar el rubro' },
];

export default function FiniaSplitExpenseDraftCard({ fields, splits, note, onAction, disabled }) {
  const isIncome = /ingreso/i.test(fields.type || '');
  const total = parseCardAmount(fields.amount);
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
          Gasto compartido
        </span>
      }
      amountLabel={total != null ? `$${formatCardAmount(total)}` : fields.amount}
      amountColorVar={inkVar}
      titleLine={fields.concept}
      ledgerRows={ledgerRows}
      confirmLabel={`✓ Confirmar y guardar (${splits.length})`}
      editActions={EDIT_ACTIONS}
      note={note}
      onAction={onAction}
      disabled={disabled}
      extra={
        <div className="px-[18px] pt-1">
          {/* "Cut here" band */}
          <div className="flex items-center gap-2">
            <div className="flex-1" style={{ borderTop: '1.5px dashed hsl(var(--receipt-perf))' }} />
            <Scissors className="w-3 h-3 rotate-90 flex-shrink-0" style={{ color: 'hsl(var(--receipt-ink-muted))' }} />
            <div className="flex-1" style={{ borderTop: '1.5px dashed hsl(var(--receipt-perf))' }} />
          </div>

          {/* Person stubs */}
          <div className="flex mt-1">
            {splits.map((s, i) => {
              const amount = parseCardAmount(s.amount);
              return (
                <div
                  key={s.name}
                  className="flex-1 text-center py-2 min-w-0"
                  style={i > 0 ? { borderLeft: '1.5px dashed hsl(var(--receipt-perf))' } : undefined}
                >
                  <div
                    className="font-receipt text-[10px] font-semibold uppercase tracking-wide truncate px-1"
                    style={{ color: 'hsl(var(--receipt-ink-muted))' }}
                  >
                    {s.name}
                  </div>
                  <div className="font-display font-bold text-[15px]" style={{ color: 'hsl(var(--receipt-ink))' }}>
                    {amount != null ? `$${formatCardAmount(amount)}` : s.amount}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      }
    />
  );
}
