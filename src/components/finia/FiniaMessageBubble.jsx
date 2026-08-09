import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertTriangle, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { parseSplitExpenseDraft, parseTransactionDraft, parseScheduledPaymentDraft, parseDuplicateWarning, stripLabeledFieldLines, classifyMessage } from '@/lib/finiaCardParser';
import { PROSE_CLASSNAME } from './markdownProse';
import FiniaSplitExpenseDraftCard from './cards/FiniaSplitExpenseDraftCard';
import FiniaTransactionDraftCard from './cards/FiniaTransactionDraftCard';
import FiniaScheduledPaymentDraftCard from './cards/FiniaScheduledPaymentDraftCard';
import FiniaDuplicateAlertCard from './cards/FiniaDuplicateAlertCard';

const typeConfig = {
  normal: { border: 'border-border', bg: 'bg-card', icon: null },
  success: { border: 'border-income/30', bg: 'bg-income/5', icon: <CheckCircle2 className="w-3.5 h-3.5 text-income flex-shrink-0 mt-0.5" /> },
  warning: { border: 'border-yellow-400/40 dark:border-yellow-500/30', bg: 'bg-yellow-50/80 dark:bg-yellow-900/10', icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" /> },
  error: { border: 'border-destructive/30', bg: 'bg-destructive/5', icon: <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" /> },
  suggestion: { border: 'border-secondary/30', bg: 'bg-secondary/5', icon: <Sparkles className="w-3.5 h-3.5 text-secondary flex-shrink-0 mt-0.5" /> },
};

export default function FiniaMessageBubble({ message, onAction, disabled }) {
  const isUser = message.role === 'user';
  const content = (message.content || '').trim();

  // Safety: don't render bubbles with empty or non-textual content
  // (handles tool-call artifacts like single emojis or "?")
  if (!content) return null;
  const visibleChars = content.replace(/[\p{Emoji}\p{P}\s]/gu, '');
  if (visibleChars.length < 2) return null;

  // Structured moments (split expense, transaction draft, scheduled-payment
  // draft, duplicate warning) get a real interactive card instead of raw
  // markdown — see finiaCardParser.js for why field-label parsing replaced
  // guessing off arbitrary prose. Checked most-specific first, since a more
  // specific draft also satisfies the looser checks below it: a split
  // expense has both a "División" breakdown AND an `amount` field (would
  // also pass parseTransactionDraft), and a scheduled payment has `dueDay`
  // AND enough fields to pass the transaction check too.
  const split = !isUser && onAction ? parseSplitExpenseDraft(content) : null;
  const scheduled = !split && !isUser && onAction ? parseScheduledPaymentDraft(content) : null;
  const draft = !split && !scheduled && !isUser && onAction ? parseTransactionDraft(content) : null;
  const duplicate = !split && !scheduled && !draft && !isUser && onAction ? parseDuplicateWarning(content) : null;

  if (split || scheduled || draft || duplicate) {
    const note = stripLabeledFieldLines(content);
    return (
      <div className="flex gap-2.5 justify-start items-end">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm shadow-sm ring-1 ring-primary/10">
          💚
        </div>
        <div className="max-w-[85%] w-full">
          {split && <FiniaSplitExpenseDraftCard fields={split.fields} splits={split.splits} note={note} onAction={onAction} disabled={disabled} />}
          {!split && scheduled && <FiniaScheduledPaymentDraftCard fields={scheduled.fields} note={note} onAction={onAction} disabled={disabled} />}
          {!split && !scheduled && draft && <FiniaTransactionDraftCard fields={draft.fields} note={note} onAction={onAction} disabled={disabled} />}
          {!split && !scheduled && !draft && duplicate && <FiniaDuplicateAlertCard fields={duplicate.fields} note={note} onAction={onAction} disabled={disabled} />}
        </div>
      </div>
    );
  }

  const msgType = isUser ? 'normal' : classifyMessage(content);
  const config = typeConfig[msgType] || typeConfig.normal;

  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} items-end`}>
      {/* Finia avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm shadow-sm ring-1 ring-primary/10">
          💚
        </div>
      )}

      {/* Bubble */}
      <div
        className={`relative max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : `${config.bg} border ${config.border} text-foreground rounded-bl-sm`
        }`}
      >
        {/* Type indicator for assistant */}
        {!isUser && config.icon && (
          <div className="flex items-start gap-1.5 mb-1.5">
            {config.icon}
          </div>
        )}

        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} className={PROSE_CLASSNAME}>
            {content}
          </ReactMarkdown>
        )}
      </div>

      {/* User avatar placeholder for alignment */}
      {isUser && <div className="w-7 flex-shrink-0" />}
    </div>
  );
}
