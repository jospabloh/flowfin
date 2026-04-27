import { createPortal } from 'react-dom';
import { X, Heart, Copy } from 'lucide-react';

function getViewportMetrics() {
  const vv = globalThis.visualViewport;
  const width = vv?.width || globalThis.innerWidth;
  const height = vv?.height || globalThis.innerHeight;
  const offsetTop = vv?.offsetTop || 0;
  const offsetLeft = vv?.offsetLeft || 0;

  return { width, height, offsetTop, offsetLeft };
}

export default function TutorialOverlay({
  step,
  targetRect,
  family,
  stepIndex,
  totalSteps,
  canGoBack,
  onBack,
  onNext,
  onLater,
  onSkip,
  onClose,
}) {
  if (!step) return null;

  const viewport = getViewportMetrics();
  const isDesktop = viewport.width >= 768;
  const showSpotlight = step.kind === 'spotlight' && !!targetRect;
  const joinCode = family?.join_code || '—';

  const copyJoinCode = async () => {
    try {
      await navigator.clipboard.writeText(joinCode);
    } catch {
      // no-op
    }
  };

  const renderStepBody = () => {
    if (step.id === 'join-code') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </p>

          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Código de familia
            </p>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="font-mono text-2xl font-black tracking-widest text-primary break-all">
                {joinCode}
              </span>

              <button
                onClick={copyJoinCode}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground space-y-2">
            <p>1. Comparte este código con quien deba unirse.</p>
            <p>2. Ese usuario debe capturarlo en la app.</p>
            <p>3. La solicitud quedará pendiente.</p>
            <p>4. Tú debes aprobarla antes de darle acceso.</p>
          </div>
        </div>
      );
    }

    if (step.id === 'final') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </p>

          <div className="rounded-2xl bg-muted/60 p-4 space-y-2 text-sm text-muted-foreground">
            <p>• Dashboard: resumen financiero</p>
            <p>• Movimientos: historial y edición</p>
            <p>• Reportes: análisis y exportación</p>
            <p>• Asistente IA: ayuda rápida</p>
            <p>• Manual: guía completa</p>
            <p>• Soporte: correo y WhatsApp</p>
          </div>

          <div className="flex items-center justify-center gap-2 text-primary font-semibold text-center">
            <Heart className="w-4 h-4 fill-current flex-shrink-0" />
            <span>Gracias por configurar FlowFin</span>
            <Heart className="w-4 h-4 fill-current flex-shrink-0" />
          </div>
        </div>
      );
    }

    return (
      <p className="text-sm text-muted-foreground leading-relaxed">
        {step.description}
      </p>
    );
  };

  return createPortal(
    <div
      className="fixed z-[120]"
      style={{
        top: viewport.offsetTop,
        left: viewport.offsetLeft,
        width: viewport.width,
        height: viewport.height,
      }}
    >
      {showSpotlight ? (
        <div
          className="pointer-events-none fixed rounded-2xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.58)] transition-all duration-200"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}

      <div
        className={
          isDesktop
            ? 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,420px)] max-h-[min(90dvh,760px)] rounded-3xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden'
            : `absolute inset-x-0 bottom-0 w-full ${step.kind === 'spotlight' ? 'max-h-[40vh]' : 'max-h-[55vh]'} rounded-t-3xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden`
        }
      >
        <div className="shrink-0 p-5 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide font-bold text-primary mb-1">
                Paso {stepIndex + 1} de {totalSteps}
              </p>
              <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
            </div>

            {!step.isFinal && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground flex-shrink-0"
                aria-label="Cerrar tutorial"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {renderStepBody()}
        </div>

        <div
          className="shrink-0 p-4 border-t border-border bg-card flex flex-wrap gap-2"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          {!step.isFinal && (
            <label className="flex items-center gap-2 w-full cursor-pointer select-none pb-1">
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary rounded"
                onChange={(e) => { if (e.target.checked) onSkip(); }}
              />
              <span className="text-sm text-muted-foreground">No mostrar más</span>
            </label>
          )}

          {canGoBack && (
            <button
              onClick={onBack}
              className="flex-1 min-w-[120px] px-4 py-3 rounded-xl bg-muted text-muted-foreground text-sm font-semibold"
            >
              Atrás
            </button>
          )}

          {!step.isFinal && (
            <>
              <button
                onClick={onLater}
                className="flex-1 min-w-[120px] px-4 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground"
              >
                Después
              </button>

              <button
                onClick={onSkip}
                className="flex-1 min-w-[120px] px-4 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground"
              >
                Omitir
              </button>
            </>
          )}

          <button
            onClick={onNext}
            className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
          >
            {step.nextLabel || 'Siguiente'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
