import { motion, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PROSE_CLASSNAME } from '../markdownProse';

// Shared "receipt" shell for Finia's draft cards (transaction, scheduled
// payment). See FiniaTransactionDraftCard for the design rationale — this
// file just factors out the shell so every draft kind stays visually
// consistent instead of hand-copying the same ticket markup per kind.
export default function FiniaTicketCard({
  eyebrow,
  badge,
  amountLabel,
  amountColorVar,
  titleLine,
  ledgerRows,
  extra,
  note,
  confirmLabel = '✓ Confirmar y guardar',
  confirmText = 'Sí, confírmalo y guárdalo',
  editActions = [],
  cancelText = 'Cancela, no lo guardes',
  onAction,
  disabled,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, rotate: -3, y: -6 }}
      animate={reduceMotion ? undefined : { opacity: 1, rotate: -0.6, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      className="finia-ticket rounded-2xl"
      style={reduceMotion ? { transform: 'rotate(-0.6deg)' } : undefined}
    >
      {/* Header: eyebrow + badge */}
      <div className="flex items-center justify-between gap-2 px-[18px] pt-4">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.09em]"
          style={{ color: 'hsl(var(--receipt-ink-muted))' }}
        >
          {eyebrow}
        </span>
        {badge}
      </div>

      {/* Amount + title line */}
      <div className="px-[18px] pt-1.5 pb-3.5">
        <div className="font-display font-extrabold text-[32px] leading-[1.05] tracking-tight" style={{ color: amountColorVar }}>
          {amountLabel}
        </div>
        {titleLine && (
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'hsl(var(--receipt-ink))' }}>
            {titleLine}
          </p>
        )}
      </div>

      {ledgerRows.length > 0 && (
        <>
          <div className="mx-[18px]" style={{ borderTop: '1.5px dashed hsl(var(--receipt-perf))' }} />
          <div className="px-[18px] pt-3 pb-1.5 font-receipt text-[11px]">
            {ledgerRows.map(({ key, label, value }) => (
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
                  {value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {extra}

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
          onClick={() => onAction(confirmText)}
          className="font-display font-extrabold text-[13px] uppercase tracking-[0.04em] px-[22px] py-2.5 rounded-[10px] border-2 border-dashed -rotate-2 transition-colors disabled:opacity-40 disabled:pointer-events-none touch-target hover:bg-[hsl(var(--receipt-income)/0.06)]"
          style={{ color: 'hsl(var(--receipt-income))', borderColor: 'hsl(var(--receipt-income))' }}
        >
          {confirmLabel}
        </button>

        {editActions.length > 0 && (
          <div className="text-[11px] text-center leading-relaxed" style={{ color: 'hsl(var(--receipt-ink-muted))' }}>
            {editActions.map(({ key, label, text }, i) => (
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
        )}

        <button
          disabled={disabled}
          onClick={() => onAction(cancelText)}
          className="text-[11px] underline underline-offset-2 disabled:opacity-40 disabled:pointer-events-none hover:opacity-80"
          style={{ color: 'hsl(var(--receipt-ink-muted))' }}
        >
          No guardar
        </button>
      </div>
    </motion.div>
  );
}
