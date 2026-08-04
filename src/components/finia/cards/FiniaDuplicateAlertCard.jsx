import { AlertTriangle, Save, Eye, Ban } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PROSE_CLASSNAME } from '../markdownProse';

// Same canned-reply phrasing DUPLICATE_CHIPS/the agent instructions use —
// tapping these sends the exact text Finia already knows how to handle.
const ACTIONS = [
  { key: 'confirm', label: 'Guardar de todos modos', text: 'Sí, guárdalo de todos modos', icon: Save, tone: 'primary' },
  { key: 'view', label: 'Ver duplicado', text: 'Muéstrame el movimiento similar', icon: Eye, tone: 'muted' },
  { key: 'cancel', label: 'No guardar', text: 'No, no lo guardes', icon: Ban, tone: 'destructive' },
];

export default function FiniaDuplicateAlertCard({ fields, note, onAction, disabled }) {
  const hasFields = Object.keys(fields || {}).length > 0;

  return (
    <div className="rounded-2xl border border-yellow-400/40 dark:border-yellow-500/30 bg-yellow-50/80 dark:bg-yellow-900/10 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300">Posible duplicado</p>
          {note && (
            <ReactMarkdown remarkPlugins={[remarkGfm]} className={`${PROSE_CLASSNAME} mt-0.5`}>{note}</ReactMarkdown>
          )}
        </div>
      </div>

      {hasFields && (
        <div className="px-4 pb-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {Object.entries(fields).map(([key, value]) => (
            <div key={key}>
              <span className="text-muted-foreground block capitalize">{key}</span>
              <span className="font-medium text-foreground">{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-yellow-400/20">
        {ACTIONS.map(({ key, label, text, icon: Icon, tone }) => (
          <button
            key={key}
            disabled={disabled}
            onClick={() => onAction(text)}
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
