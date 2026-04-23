import { Bot, Calendar, TrendingDown, TrendingUp, BarChart3, CreditCard, RefreshCw, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatAmount, formatDate, formatPersonName } from '@/lib/assistantFormatters';

// ---------------------------------------------------------------------------
// Bilingual template strings
// ---------------------------------------------------------------------------
const TEMPLATES = {
  'es-MX': {
    greeting: (name) => name ? `¡Hola ${name} 👋!` : '¡Hola! 👋',
    subtitle: 'Tu asistente financiero. Pregúntame sobre gastos, ingresos, inversiones, pagos o rentas.',
    monthSummary: ({ familyName, expense, income, balance }) =>
      `Este mes en ${familyName} llevan ` +
      `__EXPENSE__${expense}__/EXPENSE__ en gastos y ` +
      `__INCOME__${income}__/INCOME__ en ingresos. ` +
      `Balance __BALANCE__${balance}__/BALANCE__.`,
    memberExpense: (memberName, expense) => `${memberName}: __AMOUNT__${expense}__/AMOUNT__ en gastos`,
    commitmentAlert: ({ n, label, amount, dueDate }) =>
      `Tienes ${n} pago${n > 1 ? 's' : ''} próximo${n > 1 ? 's' : ''}: ` +
      `${label} __AMOUNT__${amount}__/AMOUNT__ el ${dueDate}.`,
    quickActionsLabel: 'Puedo ayudarte con:',
    staticChips: [
      { label: '💳 ¿Cuánto gasté este mes?',     intent: '¿cuánto gasté este mes?' },
      { label: '📊 Resumen de la semana',          intent: '¿cuánto gasté esta semana?' },
      { label: '📅 ¿Qué me falta pagar?',          intent: '¿qué me falta pagar?' },
      { label: '🏷️ ¿En qué gasté más?',            intent: '¿en qué gasté más este mes?' },
      { label: '📈 Comparar con mes anterior',      intent: 'comparar con mes anterior' },
      { label: '🏪 ¿Dónde gasto más?',             intent: '¿en qué comercios gasto más?' },
    ],
    ctxChips: {
      markPaid: (label) => ({ label: `✅ Marcar pagado: ${label}`, intent: `Ya pagué ${label}` }),
      firstExpense:  { label: '➕ Registrar gasto', intent: 'Quiero registrar un gasto' },
      weeklySummary: { label: '📊 Resumen semanal',  intent: '¿cuánto gasté esta semana?' },
      topCategory:   (catName) => ({ label: `🏷️ Ver gastos en ${catName}`, intent: `¿cuánto gasté en ${catName} este mes?` }),
      comparison:    { label: '📈 Comparar meses',   intent: 'comparar con mes anterior' },
      pending:       { label: '📅 Pagos pendientes', intent: '¿qué me falta pagar?' },
      topMerchant:   { label: '🏪 ¿Dónde gasto más?', intent: '¿en qué comercios gasto más?' },
      bigExpenses:   { label: '💸 Mis mayores gastos', intent: 'mis gastos más grandes este mes' },
    },
  },
  'en-US': {
    greeting: (name) => name ? `Hi ${name} 👋!` : 'Hello! 👋',
    subtitle: 'Your financial assistant. Ask me about expenses, income, investments, payments or rentals.',
    monthSummary: ({ familyName, expense, income, balance }) =>
      `This month in ${familyName} you've spent ` +
      `__EXPENSE__${expense}__/EXPENSE__ with ` +
      `__INCOME__${income}__/INCOME__ income. ` +
      `Balance __BALANCE__${balance}__/BALANCE__.`,
    memberExpense: (memberName, expense) => `${memberName}: __AMOUNT__${expense}__/AMOUNT__ spent`,
    commitmentAlert: ({ n, label, amount, dueDate }) =>
      `You have ${n} upcoming payment${n > 1 ? 's' : ''}: ` +
      `${label} __AMOUNT__${amount}__/AMOUNT__ on ${dueDate}.`,
    quickActionsLabel: 'I can help you with:',
    staticChips: [
      { label: '💳 How much did I spend this month?', intent: 'how much did I spend this month?' },
      { label: '📊 Weekly summary',                   intent: 'how much did I spend this week?' },
      { label: '📅 What do I owe?',                   intent: 'upcoming payments' },
      { label: '🏷️ Top spending categories',          intent: 'top categories this month' },
      { label: '📈 Compare with last month',          intent: 'this month vs last month' },
      { label: '🏪 Where do I spend most?',           intent: 'top merchants' },
    ],
    ctxChips: {
      markPaid: (label) => ({ label: `✅ Mark paid: ${label}`, intent: `I already paid ${label}` }),
      firstExpense:  { label: '➕ Log expense',       intent: 'I want to log an expense' },
      weeklySummary: { label: '📊 Weekly summary',    intent: 'how much did I spend this week?' },
      topCategory:   (catName) => ({ label: `🏷️ Spending in ${catName}`, intent: `how much did I spend in ${catName} this month?` }),
      comparison:    { label: '📈 Compare months',    intent: 'this month vs last month' },
      pending:       { label: '📅 Upcoming payments', intent: 'upcoming payments' },
      topMerchant:   { label: '🏪 Top merchants',     intent: 'top merchants' },
      bigExpenses:   { label: '💸 Biggest expenses',  intent: 'biggest expenses this month' },
    },
  },
};

function getTemplate(locale) {
  if (!locale) return TEMPLATES['es-MX'];
  return locale.startsWith('en') ? TEMPLATES['en-US'] : TEMPLATES['es-MX'];
}

function BoldTokens({ text }) {
  const parts = [];
  const regex = /__\w+__(.*?)__\/\w+__/g;
  let last = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <span key={key++} className="font-bold text-foreground">{match[1]}</span>
    );
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Fallback when ctx is null — shows real content immediately, no skeletons
// ---------------------------------------------------------------------------
function GenericFallback({ locale = 'es-MX', onAction }) {
  const tpl = getTemplate(locale);
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
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] space-y-1">
          <p className="text-sm text-foreground font-medium">{tpl.greeting(null)}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{tpl.subtitle}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">{tpl.quickActionsLabel}</p>

      <div className="flex flex-col gap-2">
        {tpl.staticChips.map((chip, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onAction?.(chip.intent)}
            className="text-left px-3 py-2.5 bg-muted rounded-xl text-sm text-foreground hover:bg-accent transition-colors border border-border"
          >
            {chip.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Build chips from ctx — covers all app areas
// ---------------------------------------------------------------------------
function buildChips(ctx, currentUserId, tpl) {
  const chips = [];
  const cc = tpl.ctxChips;

  // 1. Mark top upcoming commitment as paid (context-aware)
  const topCommitment = ctx?.upcomingCommitments?.[0];
  if (topCommitment) chips.push(cc.markPaid(topCommitment.label));

  // 2. Register expense if user has none this month
  const byPerson = Array.isArray(ctx?.month?.byPerson) ? ctx.month.byPerson : [];
  const myExpense = byPerson.find((p) => p.person_id === currentUserId)?.expense;
  if (!myExpense || myExpense === 0) chips.push(cc.firstExpense);

  // 3. Top category (context-aware)
  const topCat = ctx?.month?.topCategories?.[0];
  if (topCat && chips.length < 6) chips.push(cc.topCategory(topCat.name));

  // 4. Always-useful: pending payments
  if (chips.length < 6) chips.push(cc.pending);

  // 5. Compare with last month
  if (chips.length < 6) chips.push(cc.comparison);

  // 6. Where do I spend most
  if (chips.length < 6) chips.push(cc.topMerchant);

  // 7. Biggest expenses
  if (chips.length < 6) chips.push(cc.bigExpenses);

  return chips.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AssistantWelcome({ ctx, locale = 'es-MX', onAction }) {
  if (!ctx) return <GenericFallback locale={locale} onAction={onAction} />;

  const tpl = getTemplate(locale);
  const currencyCode = ctx?.family?.currency || 'MXN';
  const fmt = (value) => formatAmount(value, currencyCode, locale);

  const person     = ctx?.person ?? null;
  const personName = person ? formatPersonName(person.name) : null;
  const familyName = ctx?.family?.name ?? '';

  const monthExpense  = ctx?.month?.expense  ?? 0;
  const monthIncome   = ctx?.month?.income   ?? 0;
  const monthBalance  = ctx?.month?.balance  ?? (monthIncome - monthExpense);

  const members    = Array.isArray(ctx?.members)        ? ctx.members        : [];
  const byPersonArr = Array.isArray(ctx?.month?.byPerson) ? ctx.month.byPerson : [];

  const upcomingCommitments  = Array.isArray(ctx?.upcomingCommitments) ? ctx.upcomingCommitments : [];
  const topCommitment        = upcomingCommitments[0] ?? null;
  const extraCommitmentsCount = Math.max(0, upcomingCommitments.length - 1);

  const chips = buildChips(ctx, person?.id ?? null, tpl);

  const monthSummaryText = tpl.monthSummary({
    familyName,
    expense: fmt(monthExpense),
    income:  fmt(monthIncome),
    balance: fmt(monthBalance),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Greeting bubble */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] space-y-2">
          <p className="text-sm text-foreground font-medium">{tpl.greeting(personName)}</p>
          <p className="text-sm text-muted-foreground">
            <BoldTokens text={monthSummaryText} />
          </p>
          {members.length > 1 && (
            <ul className="mt-1 space-y-0.5">
              {members.map((member) => {
                const rec = byPersonArr.find((p) => p.person_id === member.person_id) ?? {};
                return (
                  <li key={member.person_id} className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                    <BoldTokens text={tpl.memberExpense(formatPersonName(member.name), fmt(rec.expense ?? 0))} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Upcoming commitments alert */}
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
                {locale.startsWith('en') ? `+${extraCommitmentsCount} more` : `+${extraCommitmentsCount} más`}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Quick-action chips */}
      {chips.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground text-center">{tpl.quickActionsLabel}</p>
          <div className="flex flex-col gap-2">
            {chips.map((chip, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onAction?.(chip.intent)}
                className="text-left px-3 py-2.5 bg-muted rounded-xl text-sm text-foreground hover:bg-accent transition-colors border border-border"
              >
                {chip.label}
              </motion.button>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
