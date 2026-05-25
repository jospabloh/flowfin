import { motion } from 'framer-motion';

const QUICK_ACTIONS = [
  { label: '💰 ¿Cuánto gasté este mes?', text: '¿Cuánto gasté este mes?' },
  { label: '📊 Resumen financiero', text: 'Dame un resumen de mis finanzas de este mes' },
  { label: '📅 Pagos próximos', text: '¿Qué pagos tengo próximos?' },
  { label: '🏷️ ¿En qué gasto más?', text: '¿En qué categorías gasto más?' },
  { label: '📈 Analizar gastos', text: 'Analiza mi comportamiento de gasto reciente' },
  { label: '⚠️ Ver presupuestos', text: '¿Cómo van mis presupuestos este mes?' },
];

export default function FiniaWelcome({ onAction }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 py-2"
    >
      {/* Greeting bubble */}
      <div className="flex gap-2.5">
        <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
          💚
        </div>
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 max-w-[82%]">
          <p className="text-sm font-semibold text-foreground mb-1">¡Hola! Soy Finia 💚</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tu copiloto financiero familiar. Puedo ayudarte a registrar movimientos, revisar tus finanzas, 
            detectar posibles errores y darte sugerencias para cuidar mejor el dinero de tu familia.
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <p className="text-xs text-muted-foreground text-center px-2">¿En qué te puedo ayudar hoy?</p>
      <div className="grid grid-cols-1 gap-2">
        {QUICK_ACTIONS.map((action, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onAction(action.text)}
            className="text-left px-3.5 py-2.5 bg-muted hover:bg-accent rounded-xl text-sm text-foreground transition-colors border border-border"
          >
            {action.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}