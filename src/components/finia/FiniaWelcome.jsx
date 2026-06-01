import { motion } from 'framer-motion';

const WELCOME_ACTIONS = [
  { emoji: '💸', label: 'Registrar un gasto', text: 'Quiero registrar un gasto' },
  { emoji: '💰', label: 'Registrar un ingreso', text: 'Quiero registrar un ingreso' },
  { emoji: '📊', label: 'Revisar mi mes', text: 'Dame un resumen de mis finanzas de este mes' },
  { emoji: '📅', label: 'Ver pagos próximos', text: '¿Qué pagos tengo próximos este mes?' },
];

export default function FiniaWelcome({ onAction }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center gap-6 py-8 px-2"
    >
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-3xl shadow-md ring-4 ring-primary/5">
          💚
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">Hola, soy Finia</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Tu copiloto financiero familiar</p>
        </div>
      </div>

      {/* Description */}
      <div className="bg-card border border-border rounded-2xl px-5 py-4 max-w-sm w-full text-center shadow-sm">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Puedo ayudarte a registrar movimientos, escanear recibos, revisar tu mes y encontrar oportunidades para cuidar mejor las finanzas de tu familia.
        </p>
      </div>

      {/* Quick start actions */}
      <div className="w-full max-w-sm space-y-2">
        <p className="text-xs font-medium text-muted-foreground text-center uppercase tracking-wide">¿Por dónde empezamos?</p>
        <div className="grid grid-cols-2 gap-2">
          {WELCOME_ACTIONS.map((action, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              onClick={() => onAction(action.text)}
              className="flex flex-col items-start gap-1.5 p-3.5 bg-card hover:bg-accent border border-border rounded-xl text-left transition-all active:scale-[0.97] touch-target"
            >
              <span className="text-lg">{action.emoji}</span>
              <span className="text-xs font-medium text-foreground leading-tight">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Trust line */}
      <p className="text-[11px] text-muted-foreground/60 text-center">
        🔒 Seguro, privado y atento a tu familia
      </p>
    </motion.div>
  );
}