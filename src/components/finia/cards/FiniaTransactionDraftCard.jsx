import { Check, X, Pencil, Tag, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AmountDisplay from '@/components/AmountDisplay';
import { PROSE_CLASSNAME } from '../markdownProse';

const FIELD_LABELS = {
  concept: 'Concepto',
  subcategory: 'Subrubro',
  paymentMethod: 'Forma de pago',
  date: 'Fecha',
};

// Draft/duplicate replies from Finia (see finiaCardParser.js) reuse the same
// exact reply phrasing the agent is instructed to expect back — these
// buttons are effectively canned replies, not free-text guesses.
const ACTIONS = [
  { key: 'confirm', emoji: '✅', label: 'Confirmar', text: 'Sí, confírmalo y guárdalo', icon: Check, tone: 'primary' },
  { key: 'amount', emoji: '✏️', label: 'Cambiar monto', text: 'Quiero cambiar el monto', icon: Pencil, tone: 'muted' },
  { key: 'category', emoji: '🏷️', label: 'Cambiar rubro', text: 'Quiero cambiar el rubro', icon: Tag, tone: 'muted' },
  { key: 'person', emoji: '👤', label: 'Cambiar persona', text: 'Quiero cambiar la persona', icon: User, tone: 'muted' },
  { key: 'cancel', emoji: '❌', label: 'Cancelar', text: 'Cancela, no lo guardes', icon: X, tone: 'destructive' },
];

function parseAmount(raw) {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^\d.,-]/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default function FiniaTransactionDraftCard({ fields, note, onAction, disabled }) {
  const isIncome = /ingreso/i.test(fields.type || '');
  const amount = parseAmount(fields.amount);

  return (
    <div className="rounded-2xl border border-primary/20 bg-card shadow-sm overflow-hidden">
      {/* Header: amount + type */}
      <div className={`px-4 pt-4 pb-3 ${isIncome ? 'bg-income/5' : 'bg-expense/5'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Borrador de {isIncome ? 'ingreso' : 'gasto'}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isIncome ? 'bg-income/15 text-income' : 'bg-expense/15 text-expense'}`}>
            {isIncome ? 'Ingreso' : 'Gasto'}
          </span>
        </div>
        <div className="mt-1">
          <AmountDisplay amount={amount} type={isIncome ? 'income' : 'expense'} size="xl" />
        </div>
        {fields.concept && (
          <p className="text-sm text-foreground font-medium mt-0.5">{fields.concept}</p>
        )}
      </div>

      {/* Field grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs border-t border-border">
        {fields.category && (
          <div className="col-span-2 flex items-center gap-1.5">
            <span className="text-muted-foreground">Rubro</span>
            <span className="font-medium text-foreground bg-muted px-1.5 py-0.5 rounded-full text-[11px]">{fields.category}</span>
          </div>
        )}
        {fields.person && (
          <div>
            <span className="text-muted-foreground block">Persona</span>
            <span className="font-medium text-foreground">{fields.person}</span>
          </div>
        )}
        {Object.entries(FIELD_LABELS).map(([key, label]) => {
          if (key === 'concept' || !fields[key]) return null;
          return (
            <div key={key}>
              <span className="text-muted-foreground block">{label}</span>
              <span className="font-medium text-foreground">{fields[key]}</span>
            </div>
          );
        })}
      </div>

      {/* Leftover prose (e.g. an unusual-spending warning) */}
      {note && (
        <div className="px-4 pb-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]} className={PROSE_CLASSNAME}>{note}</ReactMarkdown>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-border/60">
        {ACTIONS.map(({ key, label, icon: Icon, tone }) => (
          <button
            key={key}
            disabled={disabled}
            onClick={() => onAction(ACTIONS.find(a => a.key === key).text)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none touch-target ${
              tone === 'primary' ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : tone === 'destructive' ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
