import { createPortal } from 'react-dom';
import { X, Heart, Copy } from 'lucide-react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getViewportMetrics() {
  const vv = window.visualViewport;
  const width = vv?.width || window.innerWidth;
  const height = vv?.height || window.innerHeight;
  const offsetTop = vv?.offsetTop || 0;
  const offsetLeft = vv?.offsetLeft || 0;
  return { width, height, offsetTop, offsetLeft };
}

function getCardPosition(targetRect) {
  const viewport = getViewportMetrics();
  const safeLeft = 12;
  const safeRight = 12;
  const safeTop = 16;

  const maxWidth = Math.min(420, viewport.width - safeLeft - safeRight);
  const width = Math.max(280, maxWidth);

  if (!targetRect) {
    return {
      top: viewport.offsetTop + Math.max(20, (viewport.height - 280) / 2),
      left: viewport.offsetLeft + Math.max(safeLeft, (viewport.width - width) / 2),
      width,
      maxHeight: viewport.height - 32,
    };
  }

  const spaceBelow = viewport.offsetTop + viewport.height - targetRect.bottom;
  const spaceAbove = targetRect.top - viewport.offsetTop;
  const cardHeightEstimate = 280;

  const fitsBelow = spaceBelow >= cardHeightEstimate + 16;
  const fitsAbove = spaceAbove >= cardHeightEstimate + 16;

  let top;
  if (fitsBelow) {
    top = targetRect.bottom + 16;
  } else if (fitsAbove) {
    top = targetRect.top - cardHeightEstimate - 16;
  } else {
    top = viewport.offsetTop + Math.max(safeTop, viewport.height - cardHeightEstimate - 20);
  }

  const left = clamp(
    targetRect.left,
    viewport.offsetLeft + safeLeft,
    viewport.offsetLeft + viewport.width - width - safeRight
  );

  return {
    top,
    left,
    width,
    maxHeight: viewport.height - 24,
  };
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
  const cardPosition = getCardPosition(step.kind === 'spotlight' ? targetRect : null);
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
      className="fixed inset-0 z-[120]"
      style={{
        top: viewport.offsetTop,
        left: viewport.offsetLeft,
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
        <div className="fixed inset-0 bg-black/60" />
      )}

      <div
        className="fixed rounded-3xl border border-border bg-card shadow-2xl p-5 overflow-y-auto"
        style={cardPosition}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
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

        {renderStepBody()}

        <div className="flex flex-wrap gap-2 mt-5">
          {canGoBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-semibold"
            >
              Atrás
            </button>
          )}

          {!step.isFinal && (
            <>
              <button
                onClick={onLater}
                className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-muted-foreground"
              >
                Después
              </button>

              <button
                onClick={onSkip}
                className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-muted-foreground"
              >
                Omitir
              </button>
            </>
          )}

          <button
            onClick={onNext}
            className="ml-auto px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
          >
            {step.nextLabel || 'Siguiente'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}