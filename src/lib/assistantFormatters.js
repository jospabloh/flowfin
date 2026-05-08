/**
 * assistantFormatters.js
 * Pure formatting helpers for the AI Assistant — reusable across frontend.
 * All functions are stateless and have no side-effects.
 */

/**
 * Formats a numeric value as a localized currency string.
 * Uses Intl.NumberFormat with style 'currency'.
 *
 * @param {*}      value    - The numeric amount to format.
 * @param {string} currency - ISO 4217 currency code (default: 'MXN').
 * @param {string} locale   - BCP 47 locale tag (default: 'es-MX').
 * @returns {string} Formatted currency string, or '' if value is not a number.
 */
export function formatAmount(value, currency = 'MXN', locale = 'es-MX') {
  if (typeof value !== 'number' || isNaN(value)) return '';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Fallback: plain number if locale/currency are invalid
    return String(value);
  }
}

/**
 * Formats a Date object or ISO date string to the active locale using a
 * short numeric format (e.g. dd/mm/yyyy for es-MX, mm/dd/yyyy for en-US).
 *
 * @param {Date|string} d      - Date to format.
 * @param {string}      locale - BCP 47 locale tag (default: 'es-MX').
 * @returns {string} Short formatted date string.
 */
export function formatDate(d, locale = 'es-MX') {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return String(d);
  }
}

/**
 * Formats a date as a relative human-readable string:
 *   "hoy" / "today", "ayer" / "yesterday", "hace N días" / "N days ago",
 *   "en N días" / "in N days".
 * Falls back to formatDate() when |diff| >= 7 days.
 * Bilingual: uses ES strings for es-* locales, EN for en-* locales.
 *
 * @param {Date|string} d      - Date to format.
 * @param {string}      locale - BCP 47 locale tag (default: 'es-MX').
 * @returns {string} Relative or absolute date string.
 */
export function formatRelativeDate(d, locale = 'es-MX') {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';

  const isEn = locale.startsWith('en');

  // Truncate both dates to local midnight for day-level comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) >= 7) {
    return formatDate(date, locale);
  }

  if (diffDays === 0) return isEn ? 'today' : 'hoy';
  if (diffDays === -1) return isEn ? 'yesterday' : 'ayer';
  if (diffDays === 1) return isEn ? 'tomorrow' : 'mañana';

  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return isEn ? `${n} days ago` : `hace ${n} días`;
  }

  // diffDays > 0
  return isEn ? `in ${diffDays} days` : `en ${diffDays} días`;
}

/**
 * Capitalizes the first letter of a name and trims surrounding whitespace.
 * Returns '' if the input is falsy.
 *
 * @param {string} name - Raw name string.
 * @returns {string} Trimmed, capitalized name.
 */
export function formatPersonName(name) {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
