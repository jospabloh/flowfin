// Shared amount parsing/formatting for Finia's draft cards. Values arrive as
// free-text strings extracted by finiaCardParser.js (e.g. "$104.50", "100"),
// never as numbers, so every card needs the same parse-then-format step.

export function parseCardAmount(raw) {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^\d.,-]/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function formatCardAmount(n) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
