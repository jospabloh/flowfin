import { useRef } from 'react';

const CHIPS = [
  { emoji: '💸', label: 'Registrar gasto', text: 'Quiero registrar un gasto' },
  { emoji: '💰', label: 'Registrar ingreso', text: 'Quiero registrar un ingreso' },
  { emoji: '🧾', label: 'Escanear recibo', text: 'Quiero escanear un recibo' },
  { emoji: '📊', label: 'Revisar este mes', text: 'Dame un resumen de mis finanzas de este mes' },
  { emoji: '📅', label: 'Pagos próximos', text: '¿Qué pagos tengo próximos?' },
  { emoji: '🎯', label: 'Presupuestos', text: '¿Cómo van mis presupuestos este mes?' },
  { emoji: '🔍', label: 'Buscar duplicados', text: 'Revisa si tengo movimientos duplicados recientes' },
  { emoji: '💡', label: 'Ahorrar más', text: '¿Cómo puedo ahorrar más este mes?' },
];

export default function FiniaQuickChips({ onAction, disabled }) {
  const scrollRef = useRef(null);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 pt-0.5 px-4"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {CHIPS.map((chip, i) => (
        <button
          key={i}
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