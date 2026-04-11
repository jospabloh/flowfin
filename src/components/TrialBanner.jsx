import { useState } from 'react';
import { X, AlertCircle, Clock, Zap } from 'lucide-react';
import { useFamily } from '@/lib/FamilyContext';
import UpgradePlansModal from './UpgradePlansModal';

export default function TrialBanner() {
  const { billingStatus, trialDaysLeft } = useFamily();
  const [dismissed, setDismissed] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  // No banner for active licenses
  if (!billingStatus || billingStatus === 'active') return null;

  const isExpired = billingStatus === 'view_only' || billingStatus === 'suspended';
  const daysLeft = trialDaysLeft ?? 30;
  const urgentTrial = billingStatus === 'trial' && daysLeft <= 7;
  const warningTrial = billingStatus === 'trial' && daysLeft <= 14;

  // Only show trial banner when <= 14 days left or expired
  if (billingStatus === 'trial' && !warningTrial) return null;
  if (billingStatus === 'trial' && dismissed) return null;

  return (
    <>
      <div
        className={`px-3 py-2 flex items-center gap-2 text-xs ${
          isExpired
            ? 'bg-amber-500 text-white'
            : urgentTrial
              ? 'bg-orange-500 text-white'
              : 'bg-primary/10 text-primary border-b border-primary/20'
        }`}
      >
        {isExpired
          ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          : <Clock className="w-3.5 h-3.5 flex-shrink-0" />
        }
        <span className="flex-1 font-medium leading-tight">
          {isExpired
            ? 'Período de prueba terminado — Modo solo lectura activo'
            : daysLeft === 0
              ? 'Tu prueba vence hoy'
              : `${daysLeft} día${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''} de prueba gratuita`}
        </span>
        <button
          onClick={() => setShowPlans(true)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-[11px] flex-shrink-0 transition-colors ${
            isExpired
              ? 'bg-white text-amber-600 hover:bg-amber-50'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          <Zap className="w-3 h-3" />
          {isExpired ? 'Ver planes' : 'Activar'}
        </button>
        {!isExpired && (
          <button
            onClick={() => setDismissed(true)}
            className="p-0.5 rounded flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <UpgradePlansModal open={showPlans} onClose={() => setShowPlans(false)} />
    </>
  );
}