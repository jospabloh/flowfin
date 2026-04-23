/**
 * assistantResponders.js — Fase 4: ejecuta intents y devuelve markdown.
 * Async. Llama a base44.functions.invoke cuando no hay shortcut en ctx.
 */

import { base44 } from '@/api/base44Client';
import { formatAmount, formatDate } from '@/lib/assistantFormatters';

// ── Helpers internos ─────────────────────────────────────────────────────────

function isCurrentMonthRange(range, today = new Date()) {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  return range.start === `${y}-${m}-01`;
}

function cur(ctx) {
  return ctx.family?.currency || 'MXN';
}

function fmt(value, ctx, locale) {
  return formatAmount(value, cur(ctx), locale);
}

function isEn(locale) {
  return locale?.startsWith('en');
}

function truncatedNote(locale) {
  return isEn(locale)
    ? '\n\n⚠️ The range exceeds the query capacity; consider a shorter period.'
    : '\n\n⚠️ El rango excede la capacidad de una consulta; considera un periodo más corto.';
}

function periodLabel(range, locale) {
  const start = new Date(range.start + 'T12:00:00');
  const end = new Date(range.end + 'T12:00:00');
  const loc = locale || 'es-MX';
  const s = start.toLocaleDateString(loc, { day: 'numeric', month: 'long' });
  const e = end.toLocaleDateString(loc, { day: 'numeric', month: 'long' });
  return s === e ? s : `${s} – ${e}`;
}

// ── respondToIntent ──────────────────────────────────────────────────────────

/**
 * Executes an intent and returns a markdown string ready for MessageBubble.
 * Returns null on unrecoverable error (caller should fall back to LLM).
 *
 * @param {string} intent
 * @param {object} params
 * @param {object} ctx  - getAssistantContext output (family, month, upcomingCommitments…)
 * @param {string} locale - 'es-MX' | 'en-US'
 * @returns {Promise<string|null>}
 */
export async function respondToIntent(intent, params, ctx, locale) {
  const familyId = ctx.family?.id;
  if (!familyId) return null;

  const en = isEn(locale);

  switch (intent) {
    // ── spend_period ─────────────────────────────────────────────────────────
    case 'spend_period': {
      const { range, type, personId } = params;

      let expense, income, balance, truncated;

      try {
        const res = await base44.functions.invoke('getPeriodTotals', {
          familyId,
          start: range.start,
          end: range.end,
          type: type === 'all' ? undefined : type,
          ...(personId ? { personId } : {}),
        });
        expense   = res?.total?.expense ?? 0;
        income    = res?.total?.income  ?? 0;
        balance   = res?.total?.balance ?? (income - expense);
        truncated = res?.truncated;
      } catch {
        return null;
      }

      const period = periodLabel(range, locale);
      const balanceSign = balance < 0 ? '⚠️' : '📊';

      let lines;
      if (type === 'income') {
        lines = en
          ? `💰 Income (${period}): **${fmt(income, ctx, locale)}**`
          : `💰 Ingreso (${period}): **${fmt(income, ctx, locale)}**`;
      } else if (type === 'all') {
        lines = [
          en ? `💳 Expense: **${fmt(expense, ctx, locale)}**` : `💳 Gasto: **${fmt(expense, ctx, locale)}**`,
          en ? `💰 Income: **${fmt(income, ctx, locale)}**`   : `💰 Ingreso: **${fmt(income, ctx, locale)}**`,
          `${balanceSign} Balance: **${fmt(balance, ctx, locale)}**`,
        ].join('\n');
      } else {
        // expense (default)
        lines = en
          ? `💳 Expense (${period}): **${fmt(expense, ctx, locale)}**`
          : `💳 Gasto (${period}): **${fmt(expense, ctx, locale)}**`;
      }

      return lines + (truncated ? truncatedNote(locale) : '');
    }

    // ── who_spent_most ───────────────────────────────────────────────────────
    case 'who_spent_most': {
      const { range } = params;

      let groups, truncated;

      if (isCurrentMonthRange(range) && ctx.month?.byPerson) {
        groups    = ctx.month.byPerson;
        truncated = false;
      } else {
        try {
          const res = await base44.functions.invoke('getBreakdownByPerson', {
            familyId,
            start: range.start,
            end: range.end,
          });
          groups    = res?.groups ?? [];
          truncated = res?.truncated;
        } catch {
          return null;
        }
      }

      if (!groups || groups.length === 0) {
        return en ? 'No spending data found for the period.' : 'No hay datos de gasto para el periodo.';
      }

      const sorted = [...groups]
        .sort((a, b) => (b.expense ?? 0) - (a.expense ?? 0))
        .slice(0, 5);

      const period = periodLabel(range, locale);
      const header = en ? `👤 Spending by person (${period}):` : `👤 Gasto por persona (${period}):`;
      const rows = sorted
        .map((p) => `• **${p.name}**: ${fmt(p.expense ?? 0, ctx, locale)}`)
        .join('\n');

      return header + '\n' + rows + (truncated ? truncatedNote(locale) : '');
    }

    // ── top_category ─────────────────────────────────────────────────────────
    case 'top_category': {
      const { range, type } = params;

      let groups, truncated;

      if (isCurrentMonthRange(range) && ctx.month?.topCategories) {
        groups    = ctx.month.topCategories;
        truncated = false;
      } else {
        try {
          const res = await base44.functions.invoke('getBreakdownByCategory', {
            familyId,
            start: range.start,
            end: range.end,
            type: type || 'expense',
            topN: 5,
          });
          groups    = res?.groups ?? [];
          truncated = res?.truncated;
        } catch {
          return null;
        }
      }

      if (!groups || groups.length === 0) {
        return en ? 'No category data found.' : 'No hay datos de categorías.';
      }

      const period = periodLabel(range, locale);
      const header = en ? `📊 Top categories (${period}):` : `📊 Top categorías (${period}):`;
      const rows = groups
        .slice(0, 5)
        .map((g, i) => {
          const pct = g.pct != null ? ` (${Math.round(g.pct)}%)` : '';
          return `${i + 1}. **${g.name}** — ${fmt(g.total ?? 0, ctx, locale)}${pct}`;
        })
        .join('\n');

      return header + '\n' + rows + (truncated ? truncatedNote(locale) : '');
    }

    // ── top_merchant ─────────────────────────────────────────────────────────
    case 'top_merchant': {
      const { range, type, topN } = params;

      let groups, truncated;
      try {
        const res = await base44.functions.invoke('getBreakdownByMerchant', {
          familyId,
          start: range.start,
          end: range.end,
          type: type || 'expense',
          topN: topN || 5,
        });
        groups    = res?.groups ?? [];
        truncated = res?.truncated;
      } catch {
        return null;
      }

      if (!groups || groups.length === 0) {
        return en ? 'No merchant data found.' : 'No hay datos de comercios.';
      }

      const period = periodLabel(range, locale);
      const header = en ? `🏪 Top merchants (${period}):` : `🏪 Dónde más gastas (${period}):`;
      const rows = groups
        .slice(0, topN || 5)
        .map((g, i) => {
          const purchases = en ? `${g.count} purchase${g.count !== 1 ? 's' : ''}` : `${g.count} compra${g.count !== 1 ? 's' : ''}`;
          return `${i + 1}. **${g.merchant}** — ${fmt(g.total ?? 0, ctx, locale)} (${purchases})`;
        })
        .join('\n');

      return header + '\n' + rows + (truncated ? truncatedNote(locale) : '');
    }

    // ── averages ─────────────────────────────────────────────────────────────
    case 'averages': {
      const { range, type, personId } = params;

      let data, truncated;
      try {
        const res = await base44.functions.invoke('getAverages', {
          familyId,
          start: range.start,
          end: range.end,
          type: type || 'expense',
          ...(personId ? { personId } : {}),
        });
        data      = res;
        truncated = res?.truncated;
      } catch {
        return null;
      }

      if (!data) return null;

      const period = periodLabel(range, locale);
      const header = en ? `📊 Your averages (${period}):` : `📊 Tu promedio (${period}):`;
      const rows = [
        en ? `• Daily: ${fmt(data.avgDaily ?? 0, ctx, locale)}` : `• Diario: ${fmt(data.avgDaily ?? 0, ctx, locale)}`,
        en ? `• Weekly: ${fmt(data.avgWeekly ?? 0, ctx, locale)}` : `• Semanal: ${fmt(data.avgWeekly ?? 0, ctx, locale)}`,
        en ? `• Monthly: ${fmt(data.avgMonthly ?? 0, ctx, locale)}` : `• Mensual: ${fmt(data.avgMonthly ?? 0, ctx, locale)}`,
        en
          ? `• Median per transaction: ${fmt(data.median ?? 0, ctx, locale)}`
          : `• Mediana por transacción: ${fmt(data.median ?? 0, ctx, locale)}`,
      ].join('\n');

      return header + '\n' + rows + (truncated ? truncatedNote(locale) : '');
    }

    // ── top_transactions ─────────────────────────────────────────────────────
    case 'top_transactions': {
      const { range, type, N, personId } = params;

      let items, truncated;
      try {
        const res = await base44.functions.invoke('getTopTransactions', {
          familyId,
          start: range.start,
          end: range.end,
          type: type || 'expense',
          N: N || 10,
          ...(personId ? { personId } : {}),
        });
        items     = res?.items ?? [];
        truncated = res?.truncated;
      } catch {
        return null;
      }

      if (!items || items.length === 0) {
        return en ? 'No transactions found.' : 'No hay transacciones en el periodo.';
      }

      const period = periodLabel(range, locale);
      const count  = items.length;
      const header = en
        ? `💳 Top ${count} expenses (${period}):`
        : `💳 Top ${count} gastos (${period}):`;

      const rows = items
        .map((tx, i) => {
          const cat    = tx.category_name ? `, ${tx.category_name}` : '';
          const person = tx.person_name   ? `, ${tx.person_name}`   : '';
          const date   = tx.date          ? `, ${formatDate(tx.date, locale)}` : '';
          return `${i + 1}. **${fmt(tx.amount ?? 0, ctx, locale)}** — ${tx.description || '—'}${cat}${person}${date}`;
        })
        .join('\n');

      return header + '\n' + rows + (truncated ? truncatedNote(locale) : '');
    }

    // ── compare_periods ──────────────────────────────────────────────────────
    case 'compare_periods': {
      const { currentRange, previousRange, type } = params;

      let data, truncated;
      try {
        const res = await base44.functions.invoke('getPeriodComparison', {
          familyId,
          currentStart:  currentRange.start,
          currentEnd:    currentRange.end,
          previousStart: previousRange.start,
          previousEnd:   previousRange.end,
          type: type || 'expense',
        });
        data      = res;
        truncated = res?.truncated;
      } catch {
        return null;
      }

      if (!data) return null;

      const currAmt = data.current?.total?.expense ?? data.current?.total ?? 0;
      const prevAmt = data.previous?.total?.expense ?? data.previous?.total ?? 0;
      const pct     = data.delta?.pct != null ? Math.abs(Math.round(data.delta.pct)) : null;
      const arrow   = data.delta?.direction === 'up' ? '⬆️' : '⬇️';
      const moreOrLess = en
        ? (data.delta?.abs > 0 ? 'more' : 'less')
        : (data.delta?.abs > 0 ? 'más' : 'menos');

      const pctStr  = pct != null ? ` ${arrow} ${pct}% ${moreOrLess}` : '';
      const currLabel = en ? 'This month' : 'Este mes';
      const prevLabel = en ? 'Last month' : 'Mes anterior';

      const line = `📅 ${currLabel}: **${fmt(currAmt, ctx, locale)}** · ${prevLabel}: **${fmt(prevAmt, ctx, locale)}**${pctStr}`;

      return line + (truncated ? truncatedNote(locale) : '');
    }

    // ── whats_pending ────────────────────────────────────────────────────────
    case 'whats_pending': {
      const commitments = ctx.upcomingCommitments;

      if (!commitments || commitments.length === 0) {
        return en
          ? '✅ No upcoming payments in the next 14 days.'
          : '✅ No tienes pagos pendientes en los próximos 14 días.';
      }

      const header = en
        ? `📅 Upcoming ${commitments.length} payment${commitments.length !== 1 ? 's' : ''}:`
        : `📅 Próximos ${commitments.length} pago${commitments.length !== 1 ? 's' : ''}:`;

      const rows = commitments
        .map((c) => `• **${c.label || c.description || '—'}** — ${fmt(c.amount ?? 0, ctx, locale)} el ${formatDate(c.due_date, locale)}`)
        .join('\n');

      return header + '\n' + rows;
    }

    // ── register_expense / register_income ───────────────────────────────────
    case 'register_expense':
    case 'register_income': {
      const { amount, description, date, type, personId, methodHint } = params;

      if (!amount || !description) return null;

      const typeLabel = type === 'income'
        ? (en ? 'Income' : 'Ingreso')
        : (en ? 'Expense' : 'Gasto');

      const amtStr  = fmt(amount, ctx, locale);
      const dateStr = date ? formatDate(date, locale) : (en ? 'Today' : 'Hoy');
      const confirm = en ? 'Confirm?' : '¿Confirmas?';

      const lines = [
        en ? `✅ About to register:` : `✅ Voy a registrar:`,
        `• ${amtStr} — ${description}`,
        `• ${dateStr}`,
        ...(methodHint ? [`• ${methodHint}`] : []),
        ...(personId   ? [`• 👤 ${personId}`] : []),
        `• ${typeLabel}`,
        '',
        confirm,
      ];

      return lines.join('\n');
    }

    default:
      return null;
  }
}
