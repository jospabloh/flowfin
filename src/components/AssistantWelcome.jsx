import { Bot, Sparkles, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatAmount, formatDate, formatPersonName } from '@/lib/assistantFormatters';

// ---------------------------------------------------------------------------
// Bilingual template strings
// ---------------------------------------------------------------------------
const TEMPLATES = {
  'es-MX': {
    greeting: (name) => name ? `¡Hola ${name} 👋!` : '¡Hola! 👋',
    monthSummary: ({ familyName, expense, income, balance }) =>
      `Este mes en ${familyName} llevan ` +
      `__EXPENSE__${expense}__/EXPENSE__ en gastos y ` +
      `__INCOME__${income}__/INCOME__ en ingresos. ` +
      `Balance __BALANCE__${balance}__/BALANCE__.`,
    memberExpense: (memberName, expense) => `${memberName}: __AMOUNT__${expense}__/AMOUNT__ en gastos`,
    commitmentAlert: ({ n, label, amount, dueDate }) =>
      `Tienes ${n} pago${n > 1 ? 's' : ''} próximo${n > 1 ? 's' : ''}: ` +
      `${label} __AMOUNT__${amount}__/AMOUNT__ el ${dueDate}.`,
    quickActionsLabel: 'Acciones rápidas:',
    chips: {
      markPaid: (label) => ({ label: `Marcar pagado: ${label}`, intent: `Ya pagué ${label}` }),
      firstExpense: { label: 'Registrar mi primer gasto del mes', intent: 'Quiero registrar un gasto' },
      addInCategory: (catName) => ({ label: `Agregar gasto en ${catName}`, intent: `Registra un gasto en ${catName}` }),
      weeklySummary: { label: 'Resumen de la semana', intent: '¿cuánto gasté esta semana?' },
    },
  },
  'en-US': {
    greeting: (name) => name ? `Hi ${name} 👋!` : 'Hello! 👋',
    monthSummary: ({ familyName, expense, income, balance }) =>
      `This month in ${familyName} you've spent ` +
      `__EXPENSE__${expense}__/EXPENSE__ with ` +
      `__INCOME__${income}__/INCOME__ income. ` +
      `Balance __BALANCE__${balance}__/BALANCE__.`,
    memberExpense: (memberName, expense) => `${memberName}: __AMOUNT__${expense}__/AMOUNT__ spent`,
    commitmentAlert: ({ n, label, amount, dueDate }) =>
      `You have ${n} upcoming payment${n > 1 ? 's' : ''}: ` +
      `${label} __AMOUNT__${amount}__/AMOUNT__ on ${dueDate}.`,
    quickActionsLabel: 'Quick actions:',
    chips: {
      markPaid: (label) => ({ label: `Mark paid: ${label}`, intent: `I already paid ${label}` }),
      firstExpense: { label: 'Log my first expense this month', intent: 'I want to log an expense' },
      addInCategory: (catName) => ({ label: `Add expense in ${catName}`, intent: `Log an expense in ${catName}` }),
      weeklySummary: { label: 'Weekly summary', intent: 'how much did I spend this week?' },
    },
  },
};

// ---------------------------------------------------------------------------
// Helper: resolve template by locale with fallback to es-MX
// ---------------------------------------------------------------------------
function getTemplate(locale) {
  if (!locale) return TEMPLATES['es-MX'];
  return locale.startsWith('en') ? TEMPLATES['en-US'] : TEMPLATES['es-MX'];
}

// ---------------------------------------------------------------------------
// Helper: render a summary string that has __BOLD__value__/BOLD__ markers
// as React elements with <span className="font-bold"> around values.
// We reuse a simple token-replacement approach to avoid dangerouslySetInnerHTML.
// ---------------------------------------------------------------------------
function BoldTokens({ text }) {
  // Matches __TAG__content__/TAG__ patterns
  const parts = [];
  const regex = /__\w+__(.*?)__\/\w+__/g;
  let last = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    parts.push(
      <span key={key++} className="font-bold text-foreground">
        {match[1]}
      </span>
    );
    last = regex.lastIndex;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Chip builder — returns at most 4 chips based on ctx rules
// ---------------------------------------------------------------------------
function buildChips(ctx, currentUserId, tpl) {
  const chips = [];

  // 1. Mark top upcoming commitment as paid
  const topCommitment = ctx?.upcomingCommitments?.[0];
  if (topCommitment) {
    chips.push(tpl.chips.markPaid(topCommitment.label));
  }

  // 2. Register first expense if the logged-in user has no expenses this month
  if (currentUserId !== undefined && currentUserId !== null) {
    const byPerson = Array.isArray(ctx?.month?.byPerson) ? ctx.month.byPerson : [];
    const myRecord = byPerson.find((p) => p.person_id === currentUserId);
    const myExpense = myRecord?.expense;
    if (!myExpense || myExpense === 0) {
      chips.push(tpl.chips.firstExpense);
    }
  }

  // 3. Add expense in top category
  const topCat = ctx?.month?.topCategories?.[0];
  if (topCat && chips.length < 4) {
    chips.push(tpl.chips.addInCategory(topCat.name));
  }

  // 4. Fixed: weekly summary (always appended if there's still room)
  if (chips.length < 4) {
    chips.push(tpl.chips.weeklySummary);
  }

  return chips.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Fallback when ctx is null / undefined
// ---------------------------------------------------------------------------
function GenericFallback() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
          <p className="text-sm text-foreground">
            ¡Hola! 👋 Soy tu asistente financiero. Dime qué gastaste o recibiste y lo registro por ti automáticamente.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
/**
 * AssistantWelcome
 *
 * @param {{ ctx: object|null, locale: string, onAction: (text: string) => void }} props
 */
export default function AssistantWelcome({ ctx, locale = 'es-MX', onAction }) {
  // Graceful fallback when ctx is not yet available
  if (!ctx) {
    return <GenericFallback />;
  }

  const tpl = getTemplate(locale);

  // Resolve currency: use family.currency (ISO code) for Intl.NumberFormat
  const currencyCode = ctx?.family?.currency || 'MXN';
  const fmt = (value) => formatAmount(value, currencyCode, locale);

  // Person details
  const person = ctx?.person ?? null;
  const personName = person ? formatPersonName(person.name) : null;

  // Family details
  const familyName = ctx?.family?.name ?? '';

  // Month stats
  const monthExpense = ctx?.month?.expense ?? 0;
  const monthIncome = ctx?.month?.income ?? 0;
  const monthBalance = ctx?.month?.balance ?? (monthIncome - monthExpense);

  // Members (only show list when >1)
  const members = Array.isArray(ctx?.members) ? ctx.members : [];
  const byPersonArr = Array.isArray(ctx?.month?.byPerson) ? ctx.month.byPerson : [];

  // Upcoming commitments
  const upcomingCommitments = Array.isArray(ctx?.upcomingCommitments)
    ? ctx.upcomingCommitments
    : [];
  const topCommitment = upcomingCommitments[0] ?? null;
  const extraCommitmentsCount = Math.max(0, upcomingCommitments.length - 1);

  // Chips
  const currentUserId = person?.id ?? null;
  const chips = buildChips(ctx, currentUserId, tpl);

  // Build text fragments for month summary
  const monthSummaryText = tpl.monthSummary({
    familyName,
    expense: fmt(monthExpense),
    income: fmt(monthIncome),
    balance: fmt(monthBalance),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Greeting bubble                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] space-y-2">
          {/* Main greeting */}
          <p className="text-sm text-foreground font-medium">
            {tpl.greeting(personName)}
          </p>

          {/* Month summary with bold figures */}
          <p className="text-sm text-muted-foreground">
            <BoldTokens text={monthSummaryText} />
          </p>

          {/* Per-member breakdown (only when family has more than 1 member) */}
          {members.length > 1 && (
            <ul className="mt-1 space-y-0.5">
              {members.map((member) => {
                const memberRecord = byPersonArr.find((p) => p.person_id === member.person_id) ?? {};
                const memberExpense = memberRecord.expense ?? 0;
                const memberText = tpl.memberExpense(
                  formatPersonName(member.name),
                  fmt(memberExpense)
                );
                return (
                  <li key={member.person_id} className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                    <BoldTokens text={memberText} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Upcoming commitments alert                                           */}
      {/* ------------------------------------------------------------------ */}
      {topCommitment && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm flex gap-2 items-start">
          <Calendar className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-foreground">
            <BoldTokens
              text={tpl.commitmentAlert({
                n: upcomingCommitments.length,
                label: topCommitment.label,
                amount: fmt(topCommitment.amount),
                dueDate: formatDate(topCommitment.due_date, locale),
              })}
            />
            {extraCommitmentsCount > 0 && (
              <span className="text-muted-foreground ml-1">
                {locale.startsWith('en')
                  ? `+${extraCommitmentsCount} more`
                  : `+${extraCommitmentsCount} más`}
              </span>
            )}
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Quick-action chips                                                   */}
      {/* ------------------------------------------------------------------ */}
      {chips.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground text-center">
            {tpl.quickActionsLabel}
          </p>
          <div className="flex flex-col gap-2">
            {chips.map((chip, i) => (
              <button
                key={i}
                onClick={() => onAction?.(chip.intent)}
                className="text-left px-3 py-2.5 bg-muted rounded-xl text-sm text-foreground hover:bg-accent transition-colors border border-border"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
