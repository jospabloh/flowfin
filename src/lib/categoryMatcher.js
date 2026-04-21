/**
 * Rule-based category matcher — ZERO AI credits at runtime.
 * Uses keyword matching + usage frequency scoring.
 */

function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

export function matchCategory(text, subcategories, categories, usageStats = {}, txType = null) {
  if (!text || text.trim().length < 2) return [];

  const words = normalize(text).split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return [];

  const validCategoryIds = new Set(
    categories
      .filter(c => !txType || c.type === 'both' || c.type === txType)
      .map(c => c.id)
  );

  const results = [];

  for (const sub of subcategories) {
    if (!validCategoryIds.has(sub.category_id)) continue;

    const keywords = (sub.keywords || []).map(normalize);
    if (keywords.length === 0) continue;

    let score = 0;
    for (const word of words) {
      for (const kw of keywords) {
        if (word === kw) { score += 20; break; }
        if (kw.startsWith(word) || word.startsWith(kw)) { score += 12; break; }
        if (kw.includes(word) || word.includes(kw)) { score += 6; break; }
      }
    }

    if (score === 0) continue;

    const usageBonus = Math.min((usageStats[sub.id] || 0) * 1.5, 30);
    score += usageBonus;

    const category = categories.find(c => c.id === sub.category_id);
    results.push({ subcategory: sub, category, score });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 6);
}

// ── Voice Parser ──────────────────────────────────────────────────────────────

// Composite number words, ordered longest-first to avoid partial matches
const WORD_AMOUNTS = [
  ['veinte y', 20], ['veintiun', 21], ['veintidos', 22], ['veintitres', 23],
  ['veinticuatro', 24], ['veinticinco', 25], ['veintiseis', 26], ['veintisiete', 27],
  ['veintiocho', 28], ['veintinueve', 29],
  ['un mil quinientos', 1500], ['un mil', 1000],
  ['dos mil quinientos', 2500], ['dos mil', 2000],
  ['tres mil', 3000], ['cuatro mil', 4000], ['cinco mil', 5000],
  ['seis mil', 6000], ['siete mil', 7000], ['ocho mil', 8000], ['nueve mil', 9000],
  ['diez mil', 10000], ['quince mil', 15000], ['veinte mil', 20000],
  ['novecientos', 900], ['ochocientos', 800], ['setecientos', 700],
  ['seiscientos', 600], ['quinientos', 500], ['cuatrocientos', 400],
  ['trescientos', 300], ['doscientos', 200], ['ciento', 100], ['cien', 100],
  ['noventa', 90], ['ochenta', 80], ['setenta', 70], ['sesenta', 60],
  ['cincuenta', 50], ['cuarenta', 40], ['treinta', 30], ['veinte', 20],
  ['diecinueve', 19], ['dieciocho', 18], ['diecisiete', 17], ['dieciseis', 16],
  ['quince', 15], ['catorce', 14], ['trece', 13], ['doce', 12],
  ['once', 11], ['diez', 10], ['nueve', 9], ['ocho', 8], ['siete', 7],
  ['seis', 6], ['cinco', 5], ['cuatro', 4], ['tres', 3], ['dos', 2], ['uno', 1], ['un', 1],
  ['mil', 1000],
];

const PAYMENT_METHOD_HINTS = [
  { pattern: /\bcon\s*(tarjeta|cr[eé]dito)\b|\bcon\s*cr[eé]dito\b/i, hint: 'credit' },
  { pattern: /\bcon\s*(d[eé]bito|tarjeta\s*d[eé]bito)\b/i, hint: 'debit' },
  { pattern: /\ben?\s*efectivo\b|\bpag[ué]\s*en\s*cash\b/i, hint: 'cash' },
  { pattern: /\bpor\s*transferencia\b|\bcon\s*transferencia\b/i, hint: 'transfer' },
];

/**
 * Parses a voice transcript into structured transaction fields.
 * Returns { amount, description, date, methodHint }.
 *
 * `methodHint` is one of: 'credit' | 'debit' | 'cash' | 'transfer' | null
 * Callers should resolve methodHint to an actual paymentMethodId using their catalogs.
 */
export function parseVoiceText(text, { knownPersonNames = [] } = {}) {
  if (!text) return { amount: null, description: text, date: null, methodHint: null, personHint: null };

  let remaining = text;

  // ── Date extraction ───────────────────────────────────────────────────────────
  let date = null;
  const today = new Date();

  const datePatterns = [
    { re: /\b(hoy|ahora)\b/i, days: 0 },
    { re: /\bayer\b/i, days: -1 },
    { re: /\bantier\b|\bante\s*ayer\b/i, days: -2 },
  ];
  for (const { re, days } of datePatterns) {
    if (re.test(remaining)) {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      date = d.toISOString().slice(0, 10);
      remaining = remaining.replace(re, '');
      break;
    }
  }

  // Day-of-week relative ("el lunes", "el martes pasado")
  if (!date) {
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado'];
    const dayMatch = remaining.match(/\b(el\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i);
    if (dayMatch) {
      const dayName = normalize(dayMatch[2]);
      const normalizedDays = dayNames.map(normalize);
      const targetDay = normalizedDays.indexOf(dayName.replace('miercoles', 'miércoles').replace('sabado', 'sábado')) % 7;
      if (targetDay >= 0) {
        const d = new Date(today);
        const diff = (d.getDay() - targetDay + 7) % 7 || 7; // last occurrence
        d.setDate(d.getDate() - diff);
        date = d.toISOString().slice(0, 10);
        remaining = remaining.replace(dayMatch[0], '');
      }
    }
  }

  // "la semana pasada" → 7 days ago
  if (!date && /\bla\s*semana\s*pasada\b/i.test(remaining)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    date = d.toISOString().slice(0, 10);
    remaining = remaining.replace(/\bla\s*semana\s*pasada\b/i, '');
  }

  // ── Method hint extraction ────────────────────────────────────────────────────
  let methodHint = null;
  for (const { pattern, hint } of PAYMENT_METHOD_HINTS) {
    if (pattern.test(remaining)) {
      methodHint = hint;
      remaining = remaining.replace(pattern, '');
      break;
    }
  }

  // ── Person hint extraction ────────────────────────────────────────────────────
  let personHint = null;
  if (knownPersonNames.length > 0) {
    const lowerRemaining = remaining.toLowerCase();
    for (const name of knownPersonNames) {
      if (name && name.length > 2 && lowerRemaining.includes(name.toLowerCase())) {
        personHint = name;
        const re = new RegExp(`\\b${name}\\b`, 'gi');
        remaining = remaining.replace(re, '');
        break;
      }
    }
  }

  // ── Amount extraction: numeric digits first ───────────────────────────────────
  const numMatch = remaining.match(/(\d[\d,.]*)/);
  if (numMatch) {
    const amount = parseFloat(numMatch[1].replace(/,/g, ''));
    const description = remaining
      .replace(numMatch[0], '')
      .replace(/pesos?|mxn|dlls?|\$/gi, '')
      .trim();
    return {
      amount: isNaN(amount) ? null : amount,
      description: description || null,
      date,
      methodHint,
      personHint,
    };
  }

  // ── Amount extraction: Spanish word numbers ───────────────────────────────────
  const lower = normalize(remaining);
  for (const [word, value] of WORD_AMOUNTS) {
    const idx = lower.indexOf(word);
    if (idx === -1) continue;
    // Make sure it's a word boundary
    const before = lower[idx - 1];
    const after = lower[idx + word.length];
    if ((before !== undefined && /[a-z]/.test(before)) || (after !== undefined && /[a-z]/.test(after))) continue;
    const description = lower.replace(word, '').replace(/pesos?|mxn/g, '').trim();
    return { amount: value, description: description || null, date, methodHint, personHint };
  }

  return { amount: null, description: remaining.trim() || null, date, methodHint, personHint };
}

export function getWeekNumber(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date - start) / 86400000 + start.getDay() + 1) / 7);
}
