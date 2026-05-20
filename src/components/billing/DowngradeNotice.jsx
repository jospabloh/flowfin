import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { useFamily } from '@/lib/FamilyContext';
import UpgradePlansModal from '@/components/UpgradePlansModal';
import { track } from '@/lib/analytics';

const STORAGE_PREFIX = 'ff_downgrade_seen_';

function storageKey(familyId, billingStatus) {
  if (!familyId || !billingStatus) return null;
  return `${STORAGE_PREFIX}${familyId}:${billingStatus}`;
}

/**
 * Mounted at the top of the authenticated app. When the family transitions
 * to `view_only` or `suspended`, shows a one-time modal explaining what
 * they keep (their data) and what's gated (writes / premium features).
 *
 * Storage key is per-family + per-status, so a re-activation followed by
 * another downgrade triggers the notice again.
 */
export default function DowngradeNotice() {
  const { familyId, billingStatus, isLoading } = useFamily();
  const [open, setOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    if (isLoading || !familyId || !billingStatus) return;
    if (billingStatus !== 'view_only' && billingStatus !== 'suspended') return;
    const key = storageKey(familyId, billingStatus);
    if (!key) return;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      // localStorage unavailable; default to showing the notice once per page load
    }
    setOpen(true);
    track('downgrade_notice_shown', { billing_status: billingStatus, family_id: familyId });
  }, [familyId, billingStatus, isLoading]);

  const handleDismiss = () => {
    const key = storageKey(familyId, billingStatus);
    if (key) {
      try { localStorage.setItem(key, '1'); } catch {
        // ignore — at worst the modal shows again next session
      }
    }
    setOpen(false);
    track('downgrade_notice_dismissed', { billing_status: billingStatus });
  };

  const handleUpgrade = () => {
    track('downgrade_notice_upgrade_clicked', { billing_status: billingStatus });
    setShowUpgrade(true);
  };

  if (!open) {
    return showUpgrade
      ? <UpgradePlansModal open onClose={() => setShowUpgrade(false)} />
      : null;
  }

  const isSuspended = billingStatus === 'suspended';

  return (
    <>
      <AnimatePresence>
        <motion.div
          key="dim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
          onClick={handleDismiss}
          aria-hidden="true"
        />
        <motion.div
          key="card"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="fixed inset-x-4 top-[8%] z-[81] max-w-md mx-auto bg-card rounded-3xl border border-border shadow-2xl p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <p className="font-black text-foreground text-base">
                  {isSuspended ? 'Tu familia está suspendida' : 'Modo solo lectura activado'}
                </p>
                <p className="text-xs text-muted-foreground">Tus datos están a salvo.</p>
              </div>
            </div>
            <button onClick={handleDismiss} aria-label="Cerrar" className="p-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            {isSuspended
              ? 'La licencia fue suspendida tras un período prolongado en solo lectura. Reactívala para volver a capturar y editar.'
              : 'Tu período de prueba terminó. Mantén acceso de consulta a todo lo que ya capturaste, pero el registro de nuevos movimientos queda en pausa hasta activar tu licencia.'}
          </p>

          <div className="rounded-2xl border border-border bg-muted/40 p-4 mb-4 space-y-2 text-sm">
            <Row icon={ShieldCheck} accent="text-emerald-600" title="Sigue disponible">
              Histórico completo, reportes en consulta, exportaciones existentes, panel familiar.
            </Row>
            <Row icon={AlertTriangle} accent="text-amber-600" title="Queda pausado">
              Captura de nuevos gastos / ingresos, Inversiones, MSI, Rentas y Viajes en escritura.
            </Row>
          </div>

          <button
            type="button"
            onClick={handleUpgrade}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors"
          >
            Reactivar licencia
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground py-1"
          >
            Entendido, después lo activo
          </button>
        </motion.div>
      </AnimatePresence>
      <UpgradePlansModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>
  );
}

function Row({ icon: Icon, accent, title, children }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${accent || ''}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-bold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
