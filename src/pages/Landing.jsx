import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Loader2, Check, Copy, Users, ShieldCheck, Zap, BarChart3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { track } from '@/lib/analytics';

function readUrlParams() {
  if (typeof globalThis === 'undefined' || !globalThis.location) return {};
  try {
    const params = new URLSearchParams(globalThis.location.search || '');
    return {
      ref: (params.get('ref') || '').trim().toUpperCase().slice(0, 12),
      source: (params.get('source') || params.get('utm_source') || '').trim().toLowerCase(),
      utm_campaign: (params.get('utm_campaign') || '').trim(),
      utm_medium: (params.get('utm_medium') || '').trim(),
    };
  } catch {
    return {};
  }
}

function buildShareUrl(code) {
  if (!code) return '';
  const origin = (typeof globalThis !== 'undefined' && globalThis.location?.origin) || 'https://app.flowfin.com';
  return `${origin}/landing?ref=${code}`;
}

export default function Landing() {
  const params = useMemo(() => readUrlParams(), []);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { self_code, share_url, referrals_count, already }
  const [shareState, setShareState] = useState('idle'); // idle | copied | sharing

  useEffect(() => {
    track('landing_viewed', {
      ref: params.ref || null,
      source: params.source || null,
      utm_campaign: params.utm_campaign || null,
    });
  }, [params.ref, params.source, params.utm_campaign]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Necesito un correo válido.');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const res = await base44.functions.invoke('joinWaitlist', {
        email: trimmed,
        source: params.source || 'organic',
        ...(params.ref ? { referrer_code: params.ref } : {}),
        ...(params.utm_campaign ? { utm_campaign: params.utm_campaign } : {}),
        ...(params.utm_medium ? { utm_medium: params.utm_medium } : {}),
      });
      const data = res?.data;
      if (data?.error || !data?.success) {
        setError(data?.error === 'invalid_email' ? 'Correo inválido.' : 'No pudimos guardar tu correo. Intenta de nuevo.');
        setStatus('error');
        return;
      }
      setResult(data);
      setStatus('success');
      track('waitlist_joined', { already: Boolean(data.already), has_referrer: Boolean(params.ref) });
    } catch {
      setError('No pudimos conectar. Intenta de nuevo.');
      setStatus('error');
    }
  };

  const shareUrl = result?.self_code ? buildShareUrl(result.self_code) : '';
  const shareMessage = `Estoy probando FlowFin para llevar las finanzas en familia. Únete a la waitlist:\n${shareUrl}`;

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard?.writeText(shareMessage);
      setShareState('copied');
      track('waitlist_share_copied');
      setTimeout(() => setShareState('idle'), 1800);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    setShareState('sharing');
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Únete a FlowFin',
          text: shareMessage,
          url: shareUrl,
        });
        track('waitlist_shared', { method: 'native_share' });
        setShareState('copied');
        setTimeout(() => setShareState('idle'), 1800);
        return;
      } catch {
        // user cancelled
      }
    }
    const wa = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    globalThis.open?.(wa, '_blank', 'noopener');
    track('waitlist_shared', { method: 'whatsapp_fallback' });
    setShareState('idle');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 pt-12 pb-10 sm:pt-20 sm:pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            Próximamente · MX
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-foreground leading-[1.1] tracking-tight">
            Finanzas familiares <span className="text-primary">en 3 segundos</span>.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            Captura un gasto sin pensar. Invita a tu pareja o a tu familia. Mantén las cuentas claras sin convertirte en contador.
          </p>

          {status !== 'success' ? (
            <form onSubmit={handleSubmit} className="mt-8 max-w-md mx-auto flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-3.5 rounded-2xl border border-border bg-card text-sm placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
                disabled={status === 'loading'}
                required
              />
              <button
                type="submit"
                disabled={status === 'loading' || !email}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 disabled:opacity-50"
              >
                {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Anótame
              </button>
            </form>
          ) : (
            <SuccessBlock
              result={result}
              shareUrl={shareUrl}
              shareState={shareState}
              onCopy={handleCopy}
              onShare={handleShare}
            />
          )}
          {error && status === 'error' && (
            <p className="mt-3 text-xs text-destructive">{error}</p>
          )}
          {params.ref && status !== 'success' && (
            <p className="mt-3 text-[11px] text-muted-foreground">Llegas con la invitación <span className="font-mono font-bold text-foreground">{params.ref}</span>.</p>
          )}
        </div>
      </section>

      {/* Why */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="grid sm:grid-cols-3 gap-3">
          <Card icon={Zap} title="Captura en 3 segundos">
            Monto + enter. La categoría, persona y método se infieren del contexto.
          </Card>
          <Card icon={Users} title="Familiar por diseño">
            Invita con un código. Cada miembro captura desde su teléfono.
          </Card>
          <Card icon={ShieldCheck} title="Privado de verdad">
            Tus datos están bajo tu familia. Snapshots públicos opcionales y anonimizados.
          </Card>
        </div>
      </section>

      {/* Visual demo */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">Cómo se ve</p>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-5">Una caja. Un enter. Listo.</h2>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <Step n={1} title="Abres FlowFin">Tap al "+" desde cualquier pantalla.</Step>
            <Step n={2} title="Escribes el monto">"150 uber" — FlowFin entiende.</Step>
            <Step n={3} title="Enter">Se guarda con categoría, persona y método sugeridos.</Step>
          </div>
        </div>
      </section>

      {/* FAQ short */}
      <section className="px-6 pb-20 max-w-3xl mx-auto">
        <div className="rounded-3xl border border-border bg-card divide-y divide-border">
          <FAQ q="¿Es gratis?">
            Hay un plan gratuito mientras lanzamos. La waitlist incluye 3 meses Premium sin costo para el primer cohorte.
          </FAQ>
          <FAQ q="¿Quién ve mis datos?">
            Solo tu familia. Los "snapshots públicos" son opt-in, anonimizados y expiran en 90 días.
          </FAQ>
          <FAQ q="¿Por qué Mercado Pago?">
            Cobro local en MXN, sin tarjetas extranjeras. Lo gestiona ACACIA Consultoría.
          </FAQ>
        </div>
      </section>

      <footer className="px-6 pb-10 text-center text-[11px] text-muted-foreground">
        FlowFin · ACACIA Consultoría · MX 2026
      </footer>
    </div>
  );
}

function SuccessBlock({ result, shareUrl, shareState, onCopy, onShare }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 max-w-md mx-auto rounded-3xl border border-primary/30 bg-primary/5 p-5 text-left"
    >
      <p className="text-sm font-bold text-foreground flex items-center gap-2">
        <Check className="w-4 h-4 text-primary" />
        {result?.already ? 'Ya estabas en la lista' : '¡Estás dentro!'}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Te avisaremos cuando lancemos. Mientras tanto, sube en la cola con tu link de invitación.
      </p>
      <div className="mt-4 bg-card border border-border rounded-2xl px-3 py-2 flex items-center justify-between gap-2">
        <span className="font-mono font-bold text-primary text-sm truncate">{shareUrl}</span>
        <button
          type="button"
          onClick={onCopy}
          className="text-[11px] font-semibold text-primary px-2 py-1 rounded-lg hover:bg-primary/10 inline-flex items-center gap-1"
        >
          {shareState === 'copied' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {shareState === 'copied' ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <button
        type="button"
        onClick={onShare}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25"
      >
        <Sparkles className="w-4 h-4" />
        Compartir y subir en la cola
      </button>
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        {result?.referrals_count ? `${result.referrals_count} ya se anotaron contigo` : 'Cada amigo que se anote con tu link te adelanta lugares.'}
      </p>
    </motion.div>
  );
}

function Card({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <span className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
        <Icon className="w-4 h-4" />
      </span>
      <p className="font-bold text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{children}</p>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground font-black flex items-center justify-center text-xs mb-2">{n}</div>
      <p className="font-bold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{children}</p>
    </div>
  );
}

function FAQ({ q, children }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="px-5 py-4 cursor-pointer"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="text-sm font-bold text-foreground list-none flex items-center justify-between">
        <span>{q}</span>
        <BarChart3 className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
      </summary>
      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{children}</p>
    </details>
  );
}
