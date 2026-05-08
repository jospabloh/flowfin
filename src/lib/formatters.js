/**
 * Centralized formatting utilities.
 * Always pass locale and currency from FamilyContext — never hardcode es-MX / MXN.
 *
 * Decimal rules:
 *  - All monetary amounts       → decimals=2  → $1,200.00
 *  - Percentages                → formatPct() → 12.5%
 */

/**
 * Format a monetary amount.
 * @param {number} amount
 * @param {{ locale?: string, currency?: string, decimals?: number }} opts
 */
export function formatCurrency(amount, { locale = 'es-MX', currency = 'MXN', decimals = 2 } = {}) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, 2),
  }).format(amount || 0);
}

/**
 * Format a percentage with 1 decimal place.
 * @param {number} value  0–100
 */
export function formatPct(value) {
  return `${(value || 0).toFixed(1)}%`;
}

/**
 * Format an ISO date string (yyyy-MM-dd) for display.
 * @param {string} isoDate
 * @param {{ locale?: string, style?: 'short'|'medium'|'long' }} opts
 *   short  → "14/01"
 *   medium → "14 ene. 2025"  (default)
 *   long   → "14 de enero de 2025"
 */
export function formatDate(isoDate, { locale = 'es-MX', style = 'medium' } = {}) {
  if (!isoDate) return '—';
  // Append midday to avoid UTC-offset shifting the day
  const d = new Date(isoDate + 'T12:00:00');
  if (isNaN(d.getTime())) return isoDate;
  const opts =
    style === 'short'  ? { day: '2-digit', month: '2-digit' } :
    style === 'long'   ? { day: 'numeric', month: 'long', year: 'numeric' } :
                         { day: '2-digit', month: 'short', year: 'numeric' };
  return d.toLocaleDateString(locale, opts);
}

/**
 * Returns today as yyyy-MM-dd (local time).
 * Replaces scattered new Date().toISOString().split('T')[0] calls.
 */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
