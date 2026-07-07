import React from "react";

// Two-column auth layout (mirrors the ACACIA portfolio's canonical
// "welcome screen" structure): a centered form column on the left with an
// icon badge above the title, and a brand gradient panel with a pill badge +
// headline on the right (hidden on mobile). Colors/copy/logo stay FlowFin's own.
export default function AuthLayout({
  icon: Icon,
  title,
  subtitle = null,
  footer = null,
  children,
  showSplitPanel = true,
}) {
  return (
    <div
      className={`min-h-screen bg-background text-foreground ${
        showSplitPanel ? "lg:grid lg:grid-cols-2" : ""
      }`}
    >
      {/* ── Left: form column ─────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col px-6 py-8 lg:min-h-0 lg:px-12">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <img
            src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/5dd910449_97d3fb29c_logo.png"
            alt="FlowFin"
            className="h-9 w-9 rounded-lg object-cover"
          />
          FlowFin
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="mb-7 text-center">
            {Icon && (
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
            )}
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>

          {children}

          {footer && <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>}
        </div>

        <p className="text-center text-xs text-muted-foreground">FlowFin · Finanzas familiares</p>
      </div>

      {/* ── Right: brand panel (desktop only) ─────────────────────── */}
      {showSplitPanel && (
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary/25 via-primary/5 to-background lg:block">
          <div className="absolute inset-0 flex flex-col justify-center px-12">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              Finanzas familiares · presupuestos
            </span>
            <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-foreground">
              Controla tu dinero,
              <br />
              <span className="text-primary">no al revés</span>.
            </h2>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              Registra, analiza y planifica las finanzas de tu familia en un solo lugar.
              Sin hojas de cálculo, sin sorpresas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
