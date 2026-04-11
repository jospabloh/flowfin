import { X, Users, MessageCircle, ExternalLink } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFamily } from '@/lib/FamilyContext';

const PLANS = [
  {
    id: 'home',
    name: 'FlowFin Home',
    members: 4,
    icon: '🏠',
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    desc: 'Ideal para parejas y familias pequeñas',
  },
  {
    id: 'family_plus',
    name: 'FlowFin Family+',
    members: 10,
    icon: '👨‍👩‍👧‍👦',
    color: 'text-primary',
    bg: 'bg-primary/5',
    border: 'border-primary/30',
    desc: 'Para familias con múltiples integrantes',
    popular: true,
  },
  {
    id: 'circle',
    name: 'FlowFin Circle',
    members: 20,
    icon: '🔵',
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    desc: 'Para grupos familiares amplios y extendidos',
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
              {PLANS.map(plan => (
                <div key={plan.id} className={`relative rounded-2xl border-2 p-4 ${plan.border} ${plan.bg}`}>
                  {plan.popular && (
                    <span className="absolute -top-2.5 left-4 text-[11px] font-bold px-2.5 py-0.5 bg-primary text-primary-foreground rounded-full">
                      Más popular
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{plan.icon}</span>
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${plan.color}`}>{plan.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{plan.desc}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Users className={`w-3.5 h-3.5 ${plan.color}`} />
                        <span className={`text-xs font-semibold ${plan.color}`}>Hasta {plan.members} integrantes</span>
                      </div>
                    </div>
                  </div>
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