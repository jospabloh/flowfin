import React from "react";

// Two-column auth layout:
// Left  — form card (centered, white/card bg)
// Right — brand visual panel (hidden on mobile)
export default function AuthLayout({ title, subtitle, footer, children, showSplitPanel = true }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left: form column ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Logo */}
        <div className="w-full max-w-sm mb-8">
          <div className="flex items-center gap-2 mb-10">
            <img
              src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/5dd910449_97d3fb29c_logo.png"
              alt="FlowFin"
              className="h-8 w-8 rounded-lg object-cover"
            />
            <span className="text-lg font-bold text-foreground tracking-tight">FlowFin</span>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-1">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm mb-8">{subtitle}</p>}

          {children}

          {footer && (
            <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
          )}
        </div>
      </div>

      {/* ── Right: visual panel (desktop only) ────────────────────── */}
      {showSplitPanel && (
        <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-600 items-center justify-center">
          {/* Soft blurred circles for depth */}
          <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-blue-200/50 dark:bg-blue-900/30 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-indigo-200/40 dark:bg-indigo-900/20 blur-3xl" />

          {/* Centered tagline card */}
          <div className="relative z-10 text-center px-12">
            <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/80 dark:bg-slate-800/80 shadow-xl backdrop-blur-sm">
              <img
                src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/5dd910449_97d3fb29c_logo.png"
                alt="FlowFin"
                className="w-12 h-12 rounded-2xl object-cover"
              />
            </div>
            <h2 className="text-4xl font-bold text-slate-700 dark:text-slate-200 tracking-tight mb-3">
              Controla tu dinero,<br />no al revés.
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-base max-w-xs mx-auto">
              Registra, analiza y planifica las finanzas de tu familia en un solo lugar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}