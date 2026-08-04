import { useRef, useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { parseTransactionDraft, parseDuplicateWarning, countKnownFieldLabelMentions } from '@/lib/finiaCardParser';

// ─── Static chip sets ────────────────────────────────────────────────────────

const DEFAULT_CHIPS = [
  { emoji: '💸', label: 'Registrar gasto', text: 'Quiero registrar un gasto' },
  { emoji: '💰', label: 'Registrar ingreso', text: 'Quiero registrar un ingreso' },
  { emoji: '🧾', label: 'Escanear recibo', text: 'Quiero escanear un recibo' },
  { emoji: '📊', label: 'Revisar este mes', text: 'Dame un resumen de mis finanzas de este mes' },
  { emoji: '📅', label: 'Pagos próximos', text: '¿Qué pagos tengo próximos?' },
  { emoji: '🎯', label: 'Presupuestos', text: '¿Cómo van mis presupuestos este mes?' },
  { emoji: '🔍', label: 'Buscar duplicados', text: 'Revisa si tengo movimientos duplicados recientes' },
  { emoji: '💡', label: 'Ahorrar más', text: '¿Cómo puedo ahorrar más este mes?' },
];

const SUMMARY_CHIPS = [
  { emoji: '📊', label: 'Por categoría', text: 'Muéstrame el desglose por categoría' },
  { emoji: '👤', label: 'Por persona', text: 'Muéstrame el desglose por persona' },
  { emoji: '📅', label: 'Mes anterior', text: 'Compárame con el mes anterior' },
  { emoji: '💡', label: 'Sugerencias', text: '¿Dónde puedo ahorrar?' },
  { emoji: '🔍', label: 'Top gastos', text: '¿Cuáles fueron mis top 5 gastos?' },
];

const PAYMENTS_CHIPS = [
  { emoji: '✅', label: 'Marcar pagado', text: 'Marca como pagado el próximo pago' },
  { emoji: '📅', label: 'Esta semana', text: '¿Qué pagos tengo esta semana?' },
  { emoji: '⏳', label: 'Vencidos', text: '¿Tengo pagos vencidos?' },
  { emoji: '🎯', label: 'Presupuestos', text: '¿Cómo van mis presupuestos?' },
];

const BUDGET_CHIPS = [
  { emoji: '⚠️', label: 'Cerca del límite', text: '¿Qué categorías están cerca del límite?' },
  { emoji: '📊', label: 'Revisar mes', text: 'Dame un resumen del mes' },
  { emoji: '💡', label: 'Ahorrar', text: '¿Cómo puedo ahorrar más?' },
  { emoji: '📅', label: 'Pagos próximos', text: '¿Qué pagos tengo próximos?' },
];

// ─── Intent detection ─────────────────────────────────────────────────────────
// Returns: 'draft' | 'duplicate' | 'summary' | 'payments' | 'budget'
//          | 'ask_person' | 'ask_category' | 'ask_payment_method'
//          | 'default' | null (no chips — pure statement)
function detectIntent(msg) {
  if (!msg) return 'default';
  const c = msg.toLowerCase();

  // Structured moments — parsed with the exact same field-based logic that
  // decides whether the message bubble renders a draft/duplicate card (see
  // finiaCardParser.js), so the chips shown below never disagree with the
  // card shown above. Those cards already carry their own Confirmar/
  // Cancelar/etc. buttons, so no chips are needed here.
  if (parseTransactionDraft(msg)) return 'draft';
  if (parseDuplicateWarning(msg)) return 'duplicate';

  // A message that calls out several draft fields at once — e.g. Finia
  // asking "**Monto** (¿cuánto?) / **Concepto** (¿en qué fue?) / **Persona**
  // (¿de quién fue?) ..." — is a multi-field checklist, not a single
  // yes/no question. Must be checked before the single-field ask_*
  // detectors below, or a bolded "**Persona** (¿de quién fue?)" bullet
  // buried in a six-field list gets misread as the whole question and
  // shows person-name chips instead of nothing useful.
  if (countKnownFieldLabelMentions(msg) < 3) {
    // Catalog questions — must check BEFORE generic keyword matches
    if (/¿?(quién|quien|a nombre de quién|a nombre de quien|para quién|para quien|qué persona|que persona|de qué integrante|de que integrante|de quién|de quien)/.test(c)) return 'ask_person';
    if (/¿?(con (qué|que) (pagaste|forma de pago|método|metodo|tarjeta|efectivo)|cómo (pagaste|lo pagaste))/.test(c) || /método de pago|forma de pago|payment method/.test(c)) return 'ask_payment_method';
    if (/¿?(en (qué|que) (rubro|categoría|categoria)|a (qué|que) (rubro|categoría|categoria)|tipo de gasto|tipo de egreso|clasificar)/.test(c)) return 'ask_category';
  }

  // Financial summary
  if (c.includes('ingresos') && c.includes('gastos') && (c.includes('balance') || c.includes('mes'))) return 'summary';
  // Upcoming payments
  if (c.includes('pagos próximos') || c.includes('próximos pagos') || c.includes('vence')) return 'payments';
  // Budget
  if (c.includes('presupuesto') || c.includes('límite') || c.includes('asignado')) return 'budget';

  // Pure statements (no '?' and no action keywords) → no chips needed — show default
  return 'default';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FiniaQuickChips({ onAction, disabled, lastAssistantMessage }) {
  const scrollRef = useRef(null);
  const { familyId } = useFamily();

  const [catalogChips, setCatalogChips] = useState(null); // null = not loaded yet
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const intent = useMemo(() => detectIntent(lastAssistantMessage), [lastAssistantMessage]);

  // Fetch catalog data when intent requires it
  useEffect(() => {
    if (!familyId) return;
    if (intent !== 'ask_person' && intent !== 'ask_category' && intent !== 'ask_payment_method') {
      setCatalogChips(null);
      return;
    }

    setLoadingCatalog(true);
    setCatalogChips(null);

    const fetchers = {
      ask_person: () => base44.entities.Person.filter({ family_id: familyId }),
      ask_category: () => base44.entities.Category.filter({ family_id: familyId }),
      ask_payment_method: () => base44.entities.PaymentMethod.filter({ family_id: familyId }),
    };

    fetchers[intent]()
      .then((items) => {
        if (!items?.length) { setCatalogChips([]); return; }

        let chips;
        if (intent === 'ask_person') {
          chips = items.slice(0, 8).map(p => ({
            emoji: p.avatar_initial ? p.avatar_initial : '👤',
            label: p.name,
            text: p.name,
          }));
        } else if (intent === 'ask_category') {
          chips = items.slice(0, 8).map(cat => ({
            emoji: cat.icon || '🏷️',
            label: cat.name,
            text: cat.name,
          }));
        } else if (intent === 'ask_payment_method') {
          chips = items.slice(0, 8).map(pm => ({
            emoji: pm.type === 'credit' ? '💳' : pm.type === 'debit' ? '🏦' : pm.type === 'cash' ? '💵' : '🔁',
            label: pm.name,
            text: pm.name,
          }));
        }
        setCatalogChips(chips || []);
      })
      .catch(() => setCatalogChips([]))
      .finally(() => setLoadingCatalog(false));
  }, [intent, familyId]);

  // Determine which chips to show
  const chips = useMemo(() => {
    if (intent === 'ask_person' || intent === 'ask_category' || intent === 'ask_payment_method') {
      return catalogChips ?? [];
    }
    // 'draft'/'duplicate': the message card above already carries its own
    // action buttons — no chips needed here.
    if (intent === 'draft' || intent === 'duplicate') return [];
    if (intent === 'summary') return SUMMARY_CHIPS;
    if (intent === 'payments') return PAYMENTS_CHIPS;
    if (intent === 'budget') return BUDGET_CHIPS;
    return DEFAULT_CHIPS;
  }, [intent, catalogChips]);

  if (loadingCatalog) {
    return (
      <div className="px-4 py-1.5 flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 w-20 rounded-full bg-muted animate-pulse flex-shrink-0" />
        ))}
      </div>
    );
  }

  if (!chips.length) return null;

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 pt-0.5 px-4"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {chips.map((chip, i) => (
        <button
          key={`${chip.label}-${i}`}
          disabled={disabled}
          onClick={() => onAction(chip.text)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-card border border-border text-xs font-medium text-foreground hover:bg-accent hover:border-primary/30 active:scale-[0.96] transition-all disabled:opacity-40 disabled:pointer-events-none touch-target"
        >
          <span>{chip.emoji}</span>
          <span>{chip.label}</span>
        </button>
      ))}
    </div>
  );
}