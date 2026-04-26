import { X, MessageCircle, ExternalLink, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFamily } from '@/lib/FamilyContext';

const PLANS = [
  {
    id: 'home',
    name: 'FlowFin Home',
    price: '$299 MXN/mes',
    members: 4,
    membersDesc: 'De 1 a 4 miembros',
    icon: '🏠',
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    features: ['Gestión financiera básica', 'Organización por miembros', 'Visibilidad compartida', 'Hasta 4 miembros'],
  },
  {
    id: 'family_plus',
    name: 'FlowFin Family+',
    price: '$499 MXN/mes',
    members: 10,
    membersDesc: 'De 5 a 10 miembros',
    icon: '👨‍👩‍👧‍👦',
    color: 'text-primary',
    bg: 'bg-primary/5',
    border: 'border-primary/30',
    features: ['Incluye todo lo de Home', 'Hasta 10 miembros', 'Mejor colaboración compartida', 'Más orden para familias activas'],
    popular: true,
  },
];

export default function UpgradePlansModal({ open, onClose }) {
  const { billingStatus, trialDaysLeft } = useFamily();
  const isExpired = billingStatus === 'view_only' || billingStatus === 'suspended';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-x-4 top-[6%] z-[71] max-w-md mx-auto bg-card rounded-3xl border border-border shadow-2xl overflow-y-auto hide-scrollbar"
            style={{ maxHeight: '88vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-border flex items-start justify-between">
              <div>
                <h2 className="font-black text-xl text-foreground">Activa tu licencia</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isExpired
                    ? 'Tu período de prueba terminó. Elige un plan para seguir editando.'
                    : trialDaysLeft !== null
                      ? `Te quedan ${trialDaysLeft} días de prueba gratuita.`
                      : 'Elige el plan que mejor se adapte a tu familia.'}
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plans */}
            <div className="p-5 space-y-3">
              <p className="text-[11px] text-muted-foreground -mt-1">Suscripción mensual recurrente · IVA incluido · Gestionado vía Mercado Pago</p>
              {PLANS.map(plan => (
                <div key={plan.id} className={`relative rounded-2xl border-2 p-4 ${plan.border} ${plan.bg}`}>
                  {plan.popular && (
                    <span className="absolute -top-2.5 left-4 text-[11px] font-bold px-2.5 py-0.5 bg-primary text-primary-foreground rounded-full">
                      Más popular
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-2xl leading-none">{plan.icon}</span>
                      <div>
                        <p className={`font-bold text-sm ${plan.color}`}>{plan.name}</p>
                        <p className="text-xs text-muted-foreground">{plan.membersDesc}</p>
                      </div>
                    </div>
                    <p className={`text-base font-black ${plan.color} whitespace-nowrap`}>{plan.price}</p>
                  </div>
                  <ul className="space-y-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-foreground/80">
                        <Check className={`w-3 h-3 flex-shrink-0 ${plan.color}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="px-5 pb-6 space-y-3">
              <a
                href="https://www.acaciaco.com.mx/flowfin"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Ver precios y adquirir licencia
              </a>
              <a
                href="https://wa.me/524498958291?text=Hola%2C%20quiero%20activar%20mi%20licencia%20de%20FlowFin"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Contactar soporte por WhatsApp
              </a>
              <p className="text-center text-xs text-muted-foreground leading-relaxed">
                La activación es asistida manualmente por ACACIA Consultoría.<br />
                Contacta con tu comprobante de pago y te activaremos en minutos.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}