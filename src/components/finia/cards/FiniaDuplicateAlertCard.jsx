import { AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PROSE_CLASSNAME } from '../markdownProse';

// Shares the draft card's "ticket" vocabulary (dashed edges, warm accent)
// but stays inside the normal dark chat surface — the receipt treatment is
// reserved for the one moment money is actually about to be saved. Here the
// signal is a second stub peeking out from behind: this looks like a copy
// of something that already exists.
const ACTIONS = [
  { key: 'confirm', label: 'Guardar de todos modos', text: 'Sí, guárdalo de todos modos', tone: 'primary' },
  { key: 'view', label: 'Ver el otro movimiento', text: 'Muéstrame el movimiento similar', tone: 'muted' },
  { key: 'cancel', label: 'No guardar', text: 'No, no lo guardes', tone: 'ghost' },
];

// Same label vocabulary as the draft ledger — extractLabeledFields() returns
// internal English keys (amount, date, ...), never render those directly.
const FIELD_LABELS = {
  amount: 'Monto',
  type: 'Tipo',
  concept: 'Concepto',
  category: 'Rubro',
  subcategory: 'Subrubro',
  person: 'Persona',
  paymentMethod: 'Forma de pago',
  date: 'Fecha',
};

export default function FiniaDuplicateAlertCard({ fields, note, onAction, disabled }) {
  const hasFields = Object.keys(fields || {}).length > 0;

  return (
    <div className="relative pr-2.5 pb-2.5">
      {/* Ghost stub peeking out bottom-right — the "this looks like a copy" cue */}
      <div
        className="absolute rounded-2xl -rotate-1"
        style={{ inset: '10px 0 0 10px', background: 'hsl(var(--warning) / 0.09)', border: '1px solid hsl(var(--warning) / 0.22)' }}
      />
      <div
        className="relative rounded-2xl px-4 py-3.5 shadow-sm"
        style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--warning) / 0.32)' }}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-[15px] h-[15px] text-warning flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-warning">Podría ser un duplicado</p>
            {note && (
              <ReactMarkdown remarkPlugins={[remarkGfm]} className={`${PROSE_CLASSNAME} mt-0.5 text-foreground/85`}>
                {note}
              </ReactMarkdown>
            )}
          </div>
        </div>

        {hasFields && (
          <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs pl-[23px]">
            {Object.entries(fields).map(([key, value]) => (
              <div key={key}>
                <span className="text-muted-foreground block">{FIELD_LABELS[key] || key}</span>
                <span className="font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3 pl-[23px]">
          {ACTIONS.map(({ key, label, text, tone }) => (
            <button
              key={key}
              disabled={disabled}
              onClick={() => onAction(text)}
              className={`text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none touch-target transition-colors ${
                tone === 'primary' ? 'bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90'
                : tone === 'muted' ? 'bg-muted text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-accent hover:text-foreground'
                : 'text-muted-foreground underline underline-offset-2 hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
