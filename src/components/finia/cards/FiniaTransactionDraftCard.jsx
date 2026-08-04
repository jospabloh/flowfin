import { motion, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PROSE_CLASSNAME } from '../markdownProse';

// Finia lays out a draft the same way a receipt does: a total, an item, and
// a ledger of line items underneath. Rendering it as an actual ticket stub
// (see .finia-ticket / --receipt-* tokens in index.css) makes the one
// message in the whole chat that's about to become a real record look like
// one — instead of blending into another dark bubble.
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

function parseAmount(raw) {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^\d.,-]/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default function FiniaTransactionDraftCard({ fields, note, onAction, disabled }) {
  const reduceMotion = useReducedMotion();
  const isIncome = /ingreso/i.test(fields.type || '');
  const amount = parseAmount(fields.amount);
  const inkVar = isIncome ? 'hsl(var(--receipt-income))' : 'hsl(var(--receipt-expense))';
  const ledgerRows = LEDGER_ROWS.filter(({ key }) => fields[key]);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, rotate: -3, y: -6 }}
      animate={reduceMotion ? undefined : { opacity: 1, rotate: -0.6, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      className="finia-ticket rounded-2xl"
      style={reduceMotion ? { transform: 'rotate(-0.6deg)' } : undefined}
    >
      {/* Header: eyebrow + type badge */}
      <div className="flex items-center justify-between px-[18px] pt-4">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.09em]"
          style={{ color: 'hsl(var(--receipt-ink-muted))' }}
        >
          Borrador
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.07em] px-2 py-0.5 rounded-full"
          style={{ color: inkVar, backgroundColor: `hsl(var(--receipt-${isIncome ? 'income' : 'expense'}) / 0.1)` }}
        >
          {isIncome ? 'Ingreso' : 'Gasto'}
        </span>
      </div>

      {/* Amount + concept */}
      <div className="px-[18px] pt-1.5 pb-3.5">
        <div className="font-display font-extrabold text-[32px] leading-[1.05] tracking-tight" style={{ color: inkVar }}>
          {amount ? `$${amount.toFixed(2)}` : fields.amount}
        </div>
        {fields.concept && (
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'hsl(var(--receipt-ink))' }}>
            {fields.concept}
          </p>
        )}
      </div>

      {ledgerRows.length > 0 && (
        <>
          <div className="mx-[18px]" style={{ borderTop: '1.5px dashed hsl(var(--receipt-perf))' }} />
          <div className="px-[18px] pt-3 pb-1.5 font-receipt text-[11px]">
            {ledgerRows.map(({ key, label }) => (
              <div key={key} className="flex items-baseline gap-1.5 py-[3px]">
                <span
                  className="font-semibold uppercase tracking-[0.04em] whitespace-nowrap"
                  style={{ color: 'hsl(var(--receipt-ink-muted))' }}
                >
                  {label}
                </span>
                <span className="finia-ledger-leader" />
                <span
                  className="font-semibold text-right"
                  style={{ color: 'hsl(var(--receipt-ink))', maxWidth: '64%' }}
                >
                  {fields[key]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Leftover prose — usually just the confirmation question */}
      {note && (
        <div className="px-[18px] pt-1 pb-0.5 text-[11px] italic" style={{ color: 'hsl(var(--receipt-ink-muted))' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} className={PROSE_CLASSNAME}>{note}</ReactMarkdown>
        </div>
      )}

      <div className="mx-[18px] mt-2.5" style={{ borderTop: '1.5px dashed hsl(var(--receipt-perf))' }} />

      {/* Actions: one obvious stamp, everything else demoted to quiet text */}
      <div className="px-[18px] pt-4 pb-[18px] flex flex-col items-center gap-2.5">
        <button
          disabled={disabled}
          onClick={() => onAction('Sí, confírmalo y guárdalo')}
          className="font-display font-extrabold text-[13px] uppercase tracking-[0.04em] px-[22px] py-2.5 rounded-[10px] border-2 border-dashed -rotate-2 transition-colors disabled:opacity-40 disabled:pointer-events-none touch-target hover:bg-[hsl(var(--receipt-income)/0.06)]"
          style={{ color: 'hsl(var(--receipt-income))', borderColor: 'hsl(var(--receipt-income))' }}
        >
          ✓ Confirmar y guardar
        </button>

        <div className="text-[11px] text-center leading-relaxed" style={{ color: 'hsl(var(--receipt-ink-muted))' }}>
          {EDIT_ACTIONS.map(({ key, label, text }, i) => (
            <span key={key}>
              {i > 0 && <span className="mx-1.5 opacity-50">·</span>}
              <button
                disabled={disabled}
                onClick={() => onAction(text)}
                className="underline underline-offset-2 disabled:opacity-40 disabled:pointer-events-none hover:opacity-80"
                style={{ color: 'inherit' }}
              >
                {label}
              </button>
            </span>
          ))}
        </div>

        <button
          disabled={disabled}
          onClick={() => onAction('Cancela, no lo guardes')}
          className="text-[11px] underline underline-offset-2 disabled:opacity-40 disabled:pointer-events-none hover:opacity-80"
          style={{ color: 'hsl(var(--receipt-ink-muted))' }}
        >
          No guardar
        </button>
      </div>
    </motion.div>
  );
}
