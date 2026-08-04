// Shared ReactMarkdown prose classes for Finia's chat bubbles and cards, kept
// in one place so both render GFM (tables, strikethrough, etc.) consistently.
export const PROSE_CLASSNAME = `prose prose-sm max-w-none dark:prose-invert
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
  prose-hr:border-border prose-hr:my-2
  prose-table:text-xs prose-th:text-left prose-th:font-semibold prose-th:text-foreground prose-th:py-1 prose-th:pr-3 prose-th:border-b prose-th:border-border
  prose-td:py-1 prose-td:pr-3 prose-td:border-b prose-td:border-border/60`;
