import { useRef, useMemo } from 'react';

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

const DRAFT_CHIPS = [
  { emoji: '✅', label: 'Confirmar', text: 'Sí, confírmalo y guárdalo' },
  { emoji: '❌', label: 'Cancelar', text: 'Cancela, no lo guardes' },
  { emoji: '✏️', label: 'Cambiar monto', text: 'Quiero cambiar el monto' },
  { emoji: '🏷️', label: 'Cambiar rubro', text: 'Quiero cambiar el rubro' },
  { emoji: '👤', label: 'Cambiar persona', text: 'Quiero cambiar la persona' },
];

const DUPLICATE_CHIPS = [
  { emoji: '✅', label: 'Guardar de todos modos', text: 'Sí, guárdalo de todos modos' },
  { emoji: '❌', label: 'No guardar', text: 'No, no lo guardes' },
  { emoji: '👀', label: 'Ver duplicado', text: 'Muéstrame el movimiento similar' },
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

// Pick chips based on the last assistant message content
function pickChips(lastAssistantContent) {
  if (!lastAssistantContent) return DEFAULT_CHIPS;
  const c = lastAssistantContent.toLowerCase();

  // Draft / confirmation context
  if (c.includes('borrador') || c.includes('¿confirmas') || c.includes('confirmas que guarde')) {
    return DRAFT_CHIPS;
  }
  // Duplicate detected
  if (c.includes('duplicado') || c.includes('similar reciente') || c.includes('movimiento similar')) {
    return DUPLICATE_CHIPS;
  }
  // Financial summary / month review
  if (c.includes('ingresos') && c.includes('gastos') && (c.includes('balance') || c.includes('mes'))) {
    return SUMMARY_CHIPS;
  }
  // Upcoming payments
  if (c.includes('pagos próximos') || c.includes('próximos pagos') || c.includes('vence')) {
    return PAYMENTS_CHIPS;
  }
  // Budget status
  if (c.includes('presupuesto') || c.includes('límite') || c.includes('asignado')) {
    return BUDGET_CHIPS;
  }
  return DEFAULT_CHIPS;
}

export default function FiniaQuickChips({ onAction, disabled, lastAssistantMessage }) {
  const scrollRef = useRef(null);

  const chips = useMemo(() => pickChips(lastAssistantMessage), [lastAssistantMessage]);

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