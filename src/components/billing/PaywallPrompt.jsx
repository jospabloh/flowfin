import { useState, useEffect } from 'react';
import { Sparkles, Lock, ArrowRight } from 'lucide-react';
import UpgradePlansModal from '@/components/UpgradePlansModal';
import { track } from '@/lib/analytics';

const PLAN_LABEL = {
  home: 'Home',
  family_plus: 'Family+',
  circle: 'Circle',
};

const PRESETS = {
  'page.Investments': {
    title: 'Inversiones es parte de FlowFin Home',
    body: 'Lleva el control de tus inversiones recurrentes, calcula rendimientos y mantén el historial completo.',
  },
  'page.Rentals': {
    title: 'Rentas es parte de FlowFin Home',
    body: 'Administra tus propiedades, registra pagos por mes y monitorea cobros pendientes.',
  },
  'page.MSI': {
    title: 'Meses sin intereses es parte de FlowFin Home',
    body: 'Visualiza tus compras a meses, el avance del pago y el saldo restante.',
  },
  'page.Reports': {
    title: 'Reportes avanzados son parte de FlowFin Home',
    body: 'Gráficas comparativas, exportación PDF y análisis por categoría.',
  },
  'page.Trips': {
    title: 'Viajes es parte de FlowFin Family+',
    body: 'Divide gastos entre participantes, registra en múltiples monedas y cierra el resumen del viaje.',
  },
  'receipt_scan_quota': {
    title: 'Alcanzaste el límite de escaneos del mes',
    body: 'Sube a Home para 100 escaneos al mes o a Family+ para escaneos ilimitados.',
  },
};

/**
 * Inline paywall banner. Render this in place of (or above) a gated feature
 * when `useFeatureGate(...).status === 'denied'`.
 *
 * `feature` matches the key passed to useFeatureGate (e.g. 'page.Investments').
 * `compact=true` renders a smaller card suitable for embedding inside a
 * feature surface (e.g. a single button quota warning).
 */
export default function PaywallPrompt({ feature, requiredPlan, compact = false, title, body }) {
  const [open, setOpen] = useState(false);
  const preset = PRESETS[feature] || {};
  const resolvedTitle = title || preset.title || 'Esta función requiere un plan superior';
  const resolvedBody = body || preset.body || 'Activa una licencia para desbloquearla.';
  const planName = PLAN_LABEL[requiredPlan] || PLAN_LABEL.home;

  useEffect(() => {
    track('paywall_viewed', { feature, required_plan: requiredPlan, variant: compact ? 'compact' : 'full' });
  }, [feature, requiredPlan, compact]);

  const openUpgrade = () => {
    track('paywall_clicked', { feature, required_plan: requiredPlan, variant: compact ? 'compact' : 'full' });
    setOpen(true);
  };

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={openUpgrade}
          className="flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-full transition-colors"
        >
          <Lock className="w-3 h-3" aria-hidden="true" />
          <span>Desbloquea con {planName}</span>
        </button>
        <UpgradePlansModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <>
      <div className="m-4 sm:m-6 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">FlowFin {planName}</span>
        </div>
        <h2 className="text-lg sm:text-xl font-black text-foreground mb-1.5">{resolvedTitle}</h2>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{resolvedBody}</p>
        <button
          type="button"
          onClick={openUpgrade}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
        >
          Ver planes
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <UpgradePlansModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
