import ReactMarkdown from 'react-markdown';
import { AlertTriangle, CheckCircle2, Info, XCircle, Sparkles } from 'lucide-react';

// Detect special message types from content patterns
function detectMessageType(content) {
  if (!content) return 'normal';
  const lower = content.toLowerCase();
  if (lower.includes('✅') || lower.includes('guardado') || lower.includes('registrado correctamente')) return 'success';
  if (lower.includes('⚠️') || lower.includes('posible duplicado') || lower.includes('similar')) return 'warning';
  if (lower.includes('❌') || lower.includes('error') || lower.includes('no pude verificar') || lower.includes('algo salió mal')) return 'error';
  if (lower.includes('💡') || lower.includes('sugerencia') || lower.includes('oportunidad')) return 'suggestion';
  return 'normal';
}

const typeConfig = {
  normal: { border: 'border-border', bg: 'bg-card', icon: null },
  success: { border: 'border-income/30', bg: 'bg-income/5', icon: <CheckCircle2 className="w-3.5 h-3.5 text-income flex-shrink-0 mt-0.5" /> },
  warning: { border: 'border-yellow-400/40 dark:border-yellow-500/30', bg: 'bg-yellow-50/80 dark:bg-yellow-900/10', icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" /> },
  error: { border: 'border-destructive/30', bg: 'bg-destructive/5', icon: <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" /> },
  suggestion: { border: 'border-secondary/30', bg: 'bg-secondary/5', icon: <Sparkles className="w-3.5 h-3.5 text-secondary flex-shrink-0 mt-0.5" /> },
};

export default function FiniaMessageBubble({ message }) {
  const isUser = message.role === 'user';
  const content = (message.content || '').trim();

  // Safety: don't render bubbles with empty or non-textual content
  // (handles tool-call artifacts like single emojis or "?")
  if (!content) return null;
  const visibleChars = content.replace(/[\p{Emoji}\p{P}\s]/gu, '');
  if (visibleChars.length < 2) return null;

  const msgType = isUser ? 'normal' : detectMessageType(content);
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
          <ReactMarkdown
            className="prose prose-sm max-w-none dark:prose-invert
              [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
              prose-p:my-1 prose-p:leading-relaxed
              prose-ul:my-1 prose-ul:ml-4
              prose-ol:my-1 prose-ol:ml-4
              prose-li:my-0.5
              prose-strong:font-semibold prose-strong:text-foreground
              prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted prose-code:text-xs
              prose-h1:text-base prose-h1:font-bold prose-h1:my-2
              prose-h2:text-sm prose-h2:font-semibold prose-h2:my-1.5
              prose-h3:text-sm prose-h3:font-medium prose-h3:my-1
              prose-blockquote:border-l-2 prose-blockquote:border-primary/30 prose-blockquote:pl-3 prose-blockquote:text-muted-foreground prose-blockquote:my-2
              prose-hr:border-border prose-hr:my-2"
          >
            {content}
          </ReactMarkdown>
        )}
      </div>

      {/* User avatar placeholder for alignment */}
      {isUser && <div className="w-7 flex-shrink-0" />}
    </div>
  );
}