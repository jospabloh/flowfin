/**
 * assistantIntents.js — Fase 4: router determinístico de intents.
 * Pure JS, no React, no external libraries.
 */

import { parseVoiceText } from '@/lib/categoryMatcher';

// ── Normalize ────────────────────────────────────────────────────────────────

/**
 * Normalizes text: lowercase, removes accents, trims.
 * @param {string} text
 * @returns {string}
 */
export function normalize(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function toYMD(d) {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Resolves a date range {start, end} from natural language (ES/EN).
 * Supported: "esta semana", "este mes", "el mes pasado", "este año",
 *   "hoy", "ayer", "últimos 7 días", "últimos 30 días",
 *   "this week", "this month", "last month", "this year",
 *   "today", "yesterday", "last 7 days", "last 30 days".
 * Fallback: current month.
 * @param {string} text
 * @param {Date} today
 * @returns {{ start: string, end: string }}
 */
export function resolveDateRange(text, today = new Date()) {
  const n = normalize(text);
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();

  // "hoy" / "today"
  if (/\b(hoy|today)\b/.test(n)) {
    const day = toYMD(startOfDay(today));
    return { start: day, end: day };
  }

  // "ayer" / "yesterday"
  if (/\b(ayer|yesterday)\b/.test(n)) {
    const yest = new Date(y, m, d - 1);
    const day = toYMD(yest);
    return { start: day, end: day };
  }

  // "ultimos 7 dias" / "last 7 days"
  if (/ultimos?\s*7\s*d[ií]as|last\s*7\s*days/.test(n)) {
    return { start: toYMD(new Date(y, m, d - 6)), end: toYMD(today) };
  }

  // "ultimos 30 dias" / "last 30 days"
  if (/ultimos?\s*30\s*d[ií]as|last\s*30\s*days/.test(n)) {
    return { start: toYMD(new Date(y, m, d - 29)), end: toYMD(today) };
  }

  // "esta semana" / "this week" — Monday to today
  if (/esta\s*semana|this\s*week/.test(n)) {
    const dow = today.getDay(); // 0=Sun
    const daysToMon = (dow === 0) ? 6 : dow - 1;
    const monday = new Date(y, m, d - daysToMon);
    return { start: toYMD(monday), end: toYMD(today) };
  }

  // "el mes pasado" / "last month"
  if (/mes\s*pasado|last\s*month/.test(n)) {
    const firstOfLastMonth = new Date(y, m - 1, 1);
    const lastOfLastMonth = new Date(y, m, 0);
    return { start: toYMD(firstOfLastMonth), end: toYMD(lastOfLastMonth) };
  }

  // "este ano" / "this year"
  if (/este\s*a[nñ]o|this\s*year/.test(n)) {
    return { start: `${y}-01-01`, end: toYMD(today) };
  }

  // "este mes" / "this month" — or fallback
  // Matches explicitly or used as default
  const firstOfMonth = new Date(y, m, 1);
  return { start: toYMD(firstOfMonth), end: toYMD(today) };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isCurrentMonth(range, today = new Date()) {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const firstOfMonth = `${y}-${m}-01`;
  return range.start === firstOfMonth;
}

function findPersonMatch(n, knownPersonNames = []) {
  for (const person of knownPersonNames) {
    if (!person?.name) continue;
    const normName = normalize(person.name);
    if (normName.length > 2 && n.includes(normName)) {
      return person.id;
    }
  }
  return undefined;
}

// ── detectIntent ─────────────────────────────────────────────────────────────

/**
 * Detects the intent from a user message.
 * @param {string} text
 * @param {{ today?: Date, knownPersonNames?: Array<{id:string,name:string}>, upcomingCommitments?: any[] }} ctx
 * @returns {{ intent: string, confidence: number, params: object } | null}
 */
export function detectIntent(text, ctx = {}) {
  if (!text || text.trim().length < 2) return null;

  const { today = new Date(), knownPersonNames = [] } = ctx;
  const n = normalize(text);
  const range = resolveDateRange(text, today);

  // ── capabilities ───────────────────────────────────────────────────────────
  if (
    /qu[eé]\s*puedes\s*(hacer|ayudarme)/.test(n) ||
    /para\s*qu[eé]\s*(sirves|eres)/.test(n) ||
    /\b(ayuda|help|ayúdame|help\s*me)\b/.test(n) ||
    /what\s*can\s*you\s*do/.test(n) ||
    /how\s*can\s*you\s*help/.test(n)
  ) {
    return { intent: 'capabilities', confidence: 0.95, params: {} };
  }

  // ── compare_periods ────────────────────────────────────────────────────────
  if (
    /este\s*mes\s*(vs|versus|contra)\s*(el\s*)?mes\s*(pasado|anterior)/.test(n) ||
    /comparar\s*(con\s*)?(el\s*)?mes\s*(pasado|anterior)/.test(n) ||
    /this\s*month\s*(vs|versus)\s*last\s*month/.test(n) ||
    /\bcompar(e|ar)\b/.test(n)
  ) {
    const t = today;
    const currentStart = toYMD(new Date(t.getFullYear(), t.getMonth(), 1));
    const currentEnd = toYMD(t);
    const prevFirst = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    const prevLast = new Date(t.getFullYear(), t.getMonth(), 0);
    return {
      intent: 'compare_periods',
      confidence: 0.85,
      params: {
        currentRange: { start: currentStart, end: currentEnd },
        previousRange: { start: toYMD(prevFirst), end: toYMD(prevLast) },
        type: 'expense',
      },
    };
  }

  // ── who_spent_most ─────────────────────────────────────────────────────────
  if (
    /quien\s*(gast[oó]\s*mas|gasta\s*mas)/.test(n) ||
    /who\s*(spent|spends)\s*(the\s*)?most/.test(n)
  ) {
    return { intent: 'who_spent_most', confidence: 0.9, params: { range } };
  }

  // ── whats_pending ──────────────────────────────────────────────────────────
  if (
    /qu[eé]\s*me\s*falta\s*pagar/.test(n) ||
    /pagos?\s*pendientes/.test(n) ||
    /\bcompromisos?\b/.test(n) ||
    /upcoming\s*payments/.test(n) ||
    /what\s*do\s*i\s*owe/.test(n)
  ) {
    return { intent: 'whats_pending', confidence: 0.9, params: {} };
  }

  // ── top_category ───────────────────────────────────────────────────────────
  if (
    /en\s*qu[eé]\s*gast[eé]\s*m[aá]s/.test(n) ||
    /mis\s*categor[ií]as/.test(n) ||
    /gasto\s*por\s*categor[ií]a/.test(n) ||
    /en\s*qu[eé]\s*se\s*me\s*va\s*(el\s*)?dinero/.test(n) ||
    /top\s*categor(y|ies)/.test(n) ||
    /where\s*does\s*my\s*money\s*go/.test(n) ||
    /spending\s*by\s*categor/.test(n)
  ) {
    return {
      intent: 'top_category',
      confidence: 0.85,
      params: { range, type: 'expense' },
    };
  }

  // ── top_merchant ───────────────────────────────────────────────────────────
  if (
    /qu[eé]\s*comercios/.test(n) ||
    /donde\s*gasto?\s*m[aá]s/.test(n) ||
    /\bnegocios?\b/.test(n) ||
    /top\s*merchants?/.test(n) ||
    /top\s*stores?/.test(n)
  ) {
    return {
      intent: 'top_merchant',
      confidence: 0.85,
      params: { range, type: 'expense', topN: 5 },
    };
  }

  // ── averages ───────────────────────────────────────────────────────────────
  if (
    /\bpromedio\b/.test(n) ||
    /cu[aá]nto\s*gasto\s*al\s*d[ií]a/.test(n) ||
    /\baverage\b/.test(n) ||
    /daily\s*spending/.test(n) ||
    /weekly\s*spending/.test(n)
  ) {
    let personId = findPersonMatch(n, knownPersonNames);
    const isFamilyQ = /\b(familia|todos|all|everyone)\b/.test(n);
    if (!personId && !isFamilyQ) personId = ctx.authPersonId;
    return {
      intent: 'averages',
      confidence: 0.85,
      params: { range, type: 'expense', ...(personId ? { personId } : {}) },
    };
  }

  // ── top_transactions ───────────────────────────────────────────────────────
  if (
    /mis\s*top\s*gastos/.test(n) ||
    /gastos?\s*m[aá]s\s*grandes/.test(n) ||
    /biggest\s*expenses/.test(n) ||
    /top\s*expenses/.test(n)
  ) {
    let personId = findPersonMatch(n, knownPersonNames);
    const isFamilyQ = /\b(familia|todos|all|everyone)\b/.test(n);
    if (!personId && !isFamilyQ) personId = ctx.authPersonId;
    return {
      intent: 'top_transactions',
      confidence: 0.85,
      params: { range, type: 'expense', N: 10, ...(personId ? { personId } : {}) },
    };
  }

  // ── register_expense / register_income ─────────────────────────────────────
  const isExpenseKeyword = /\b(gast[eé]|pagu[eé]|spent|paid)\b/.test(n);
  const isIncomeKeyword = /\b(recib[ií]|cobr[eé]|received|got\s*paid)\b/.test(n);

  if (isExpenseKeyword || isIncomeKeyword) {
    const parsed = parseVoiceText(text, {
      knownPersonNames: knownPersonNames.map((p) => p.name),
    });
    if (!parsed.amount) return null; // fall to LLM if no amount

    const txType = isIncomeKeyword ? 'income' : 'expense';
    let personId = parsed.personHint
      ? knownPersonNames.find((p) => normalize(p.name) === normalize(parsed.personHint))?.id
      : undefined;
    if (!personId) {
      personId = ctx.authPersonId;
    }

    const confidence = parsed.amount && parsed.description ? 0.8 : 0.65;
    if (confidence < 0.75) return null; // fall to LLM

    return {
      intent: txType === 'income' ? 'register_income' : 'register_expense',
      confidence,
      params: {
        amount: parsed.amount,
        description: parsed.description,
        date: parsed.date || toYMD(today),
        type: txType,
        ...(personId ? { personId } : {}),
        ...(parsed.methodHint ? { methodHint: parsed.methodHint } : {}),
      },
    };
  }

  // ── spend_period ───────────────────────────────────────────────────────────
  const spendES =
    /cu[aá]nto\s*(gast[eé]|llev[oa]|llego|he\s*gastado|es\s*mi\s*gasto|llevo\s*gastado|llega\s*gastado)/.test(n) ||
    /cu[aá]nto\s+llev[oa]/.test(n) ||
    /cu[aá]nto\s+llego/.test(n) ||
    /cu[aá]nto\s*(he|he\s*llegado)\s*gastado/.test(n) ||
    /cu[aá]nto\s*ingres[eé]/.test(n) ||
    /mi\s*ingreso/.test(n) ||
    /\b(balance|saldo)\b/.test(n) ||
    /gasto\s*(total|del\s*mes|mensual|semanal|diario)/.test(n) ||
    /total\s*(de\s*(mis\s*)?gastos|gastado)/.test(n) ||
    /cu[aá]nto\s*(he\s*)?gastado\s*(en\s*)?(este|el)?\s*mes/.test(n) ||
    /cu[aá]nto\s*(llevo|tengo)\s*(gastado|de\s*gasto)/.test(n) ||
    /resumen\s*(del\s*mes|mensual|financiero|de\s*gastos)/.test(n) ||
    /c[oó]mo\s*(voy|estoy|est[aá])\s*(con\s*)?(el\s*)?(gasto|dinero|presupuesto|finanzas)/.test(n) ||
    /mis\s*(gastos|finanzas|n[uú]meros)\s*(del\s*mes|de\s*hoy|de\s*esta\s*semana)?/.test(n) ||
    /cu[aá]nto\s*(dinero|plata)\s*(he\s*)?gastado/.test(n) ||
    /en\s*qu[eé]\s*me\s*gast[eé]/.test(n) ||
    /gastos?\s*(de\s*)?(hoy|esta\s*semana|este\s*mes|este\s*a[nñ]o)/.test(n) ||
    /ingreso[s]?\s*(de\s*)?(hoy|esta\s*semana|este\s*mes|este\s*a[nñ]o)/.test(n);
  const spendEN =
    /how\s*much\s*(have\s*i\s*spent|did\s*i\s*spend)/.test(n) ||
    /my\s*spending/.test(n) ||
    /my\s*income/.test(n) ||
    /\b(balance)\b/.test(n) ||
    /how\s*(am\s*i\s*doing|are\s*my\s*finances)/.test(n) ||
    /spending\s*(summary|total|this\s*month|today|this\s*week)/.test(n) ||
    /total\s*(expenses?|spending|income)\s*(for|this)?\s*(month|week|year|today)?/.test(n) ||
    /what\s*(did\s*i|have\s*i)\s*spend/.test(n);

  if (spendES || spendEN) {
    let type = 'expense';
    if (/ingres|income/.test(n)) type = 'income';
    if (/balance|saldo/.test(n)) type = 'all';

    // 1. Explicit named person: "¿cuánto gastó Silvia?"
    let personId = findPersonMatch(n, knownPersonNames);

    // 2. Family/all keyword → no personId (return full family totals)
    const isFamilyQuery = /\b(familia|todos|all|everyone)\b/.test(n);

    // 3. Default: always scope to the logged-in user, matching dashboard behavior
    if (!personId && !isFamilyQuery) {
      personId = ctx.authPersonId;
    }

    // Confidence is higher if there's a clear period keyword
    const hasPeriod =
      /semana|mes|a[nñ]o|d[ií]a|week|month|year|day|today|hoy|ayer|yesterday/.test(n);
    const confidence = hasPeriod ? 0.85 : 0.75;

    return {
      intent: 'spend_period',
      confidence,
      params: { range, type, ...(personId ? { personId } : {}) },
    };
  }

  return null;
}

export { isCurrentMonth };