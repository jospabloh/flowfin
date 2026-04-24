import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Zap, CheckCircle2, AlertCircle, Loader2, ChevronRight, Clock, Bot } from 'lucide-react';
import { cn } from "@/lib/utils";

const FunctionDisplay = ({ toolCall }) => {
    const [expanded, setExpanded] = useState(false);
    const name = toolCall?.name || 'Function';
    const status = toolCall?.status || 'pending';
    const results = toolCall?.results;

    const parsedResults = (() => {
        if (!results) return null;
        try { return typeof results === 'string' ? JSON.parse(results) : results; }
        catch { return results; }
    })();

    const isError = results && (
        (typeof results === 'string' && /error|failed/i.test(results)) ||
        (parsedResults?.success === false)
    );

    const statusConfig = {
        pending:     { icon: Clock,        color: 'text-muted-foreground', text: 'Pendiente' },
        running:     { icon: Loader2,      color: 'text-primary',          text: 'Procesando…', spin: true },
        in_progress: { icon: Loader2,      color: 'text-primary',          text: 'Procesando…', spin: true },
        completed:   isError
            ? { icon: AlertCircle,  color: 'text-destructive', text: 'Error' }
            : { icon: CheckCircle2, color: 'text-income',      text: 'Listo' },
        success:     { icon: CheckCircle2, color: 'text-income',      text: 'Listo' },
        failed:      { icon: AlertCircle,  color: 'text-destructive', text: 'Error' },
        error:       { icon: AlertCircle,  color: 'text-destructive', text: 'Error' },
    }[status] || { icon: Zap, color: 'text-muted-foreground', text: '' };

    const Icon = statusConfig.icon;
    const formattedName = name.split('_').join(' ');

    return (
        <div className="mt-1.5 text-xs">
            <button
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all",
                    "hover:bg-muted",
                    expanded ? "bg-muted border-border" : "bg-card border-border"
                )}
            >
                <Icon className={cn("h-3 w-3 flex-shrink-0", statusConfig.color, statusConfig.spin && "animate-spin")} />
                <span className="text-muted-foreground">{formattedName}</span>
                {statusConfig.text && (
                    <span className={cn("text-muted-foreground/70", isError && "text-destructive")}>
                        · {statusConfig.text}
                    </span>
                )}
                {(toolCall.arguments_string || results) && (
                    <ChevronRight className={cn("h-3 w-3 text-muted-foreground/50 transition-transform ml-auto", expanded && "rotate-90")} />
                )}
            </button>

            {expanded && (
                <div className="mt-1 ml-3 pl-3 border-l-2 border-border space-y-1.5">
                    {toolCall.arguments_string && (
                        <pre className="bg-muted rounded p-2 text-xs text-foreground whitespace-pre-wrap max-h-28 overflow-auto">
                            {(() => { try { return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2); } catch { return toolCall.arguments_string; } })()}
                        </pre>
                    )}
                    {parsedResults && (
                        <pre className="bg-muted rounded p-2 text-xs text-foreground whitespace-pre-wrap max-h-28 overflow-auto">
                            {typeof parsedResults === 'object' ? JSON.stringify(parsedResults, null, 2) : String(parsedResults)}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
};

export default function MessageBubble({ message, hideAvatar = false }) {
    const isUser = message.role === 'user';

    return (
        <div className={cn("flex items-end gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
            {/* Avatar — only for assistant, hidden when grouped */}
            {!isUser && (
                <div className="w-7 h-7 flex-shrink-0 mb-0.5">
                    {!hideAvatar && (
                        <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Bot className="w-3.5 h-3.5 text-primary" />
                        </div>
                    )}
                </div>
            )}

            <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start", "max-w-[80%]")}>
                {/* Content bubble */}
                {message.content && (
                    <div className={cn(
                        "px-4 py-2.5 text-sm leading-relaxed",
                        isUser
                            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                            : "bg-card border border-border text-foreground rounded-2xl rounded-bl-sm"
                    )}>
                        {isUser ? (
                            <p>{message.content}</p>
                        ) : (
                            <ReactMarkdown
                                className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                                components={{
                                    p:  ({ children }) => <p className="mb-1 last:mb-0 leading-relaxed">{children}</p>,
                                    ul: ({ children }) => <ul className="ml-4 list-disc mb-1">{children}</ul>,
                                    ol: ({ children }) => <ol className="ml-4 list-decimal mb-1">{children}</ol>,
                                    li: ({ children }) => <li className="my-0.5">{children}</li>,
                                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                                    code: ({ children }) => <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{children}</code>,
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        )}
                    </div>
                )}

                {/* Tool calls */}
                {message.tool_calls?.length > 0 && (
                    <div className="w-full space-y-1">
                        {message.tool_calls.map((tc, idx) => (
                            <FunctionDisplay key={idx} toolCall={tc} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}