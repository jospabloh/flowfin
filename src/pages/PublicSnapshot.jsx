import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, Plane, BarChart3, Sparkles, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { track } from '@/lib/analytics';

const COPY = {
  goal_achieved: {
    title: '🎯 Una meta menos pendiente',
    cta: 'Crea la tuya en FlowFin',
    icon: Target,
    color: 'from-emerald-500/40 via-emerald-500/10 to-transparent',
    docTitle: 'Logró su meta en FlowFin',
    docDescription: 'Una persona acaba de cerrar una meta financiera en FlowFin. Tú puedes empezar la tuya en minutos.',
  },
  trip_summary: {
    title: '✈️ Viaje cerrado, cuentas claras',
    cta: 'Organiza tu próximo viaje',
    icon: Plane,
    color: 'from-sky-500/40 via-sky-500/10 to-transparent',
    docTitle: 'Resumen de viaje en FlowFin',
    docDescription: 'Cerró un viaje completo en FlowFin: split entre participantes, monedas y presupuesto al día.',
  },
  monthly_report: {
    title: '📊 Un mes mejor llevado',
    cta: 'Lleva tu mes así',
    icon: BarChart3,
    color: 'from-violet-500/40 via-violet-500/10 to-transparent',
    docTitle: 'Mi mes en FlowFin',
    docDescription: 'Así llevamos el mes en casa: ingresos, gastos y categorías top, anonimizadas.',
  },
  budget_kept: {
    title: '💚 Presupuesto cumplido',
    cta: 'Cumple el tuyo',
    icon: Sparkles,
    color: 'from-amber-500/40 via-amber-500/10 to-transparent',
    docTitle: 'Presupuesto cumplido en FlowFin',
    docDescription: 'Otro mes dentro del presupuesto. Empieza el tuyo en FlowFin.',
  },
};

/**
 * Updates document.title + the dynamic og:* / twitter:* meta tags so the
 * snapshot is recognizable in browser tabs and in the share-cards rendered
 * by crawlers that execute JavaScript (Discord, Slack, Twitterbot in a
 * partial sense). WhatsApp / Facebook crawlers do NOT execute JS and rely
 * on the static OG tags in index.html — that's the deliberate trade-off
 * we accept until a server-rendered preview is shipped.
 */
function applyDocumentMeta({ docTitle, docDescription }) {
  if (typeof document === 'undefined') return;
  if (docTitle) document.title = `${docTitle} · FlowFin`;
  const set = (selector, attr, value) => {
    if (!value) return;
    const el = document.head.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };
  set('meta[name="description"]', 'content', docDescription);
  set('meta[property="og:title"]', 'content', `${docTitle} · FlowFin`);
  set('meta[property="og:description"]', 'content', docDescription);
  set('meta[name="twitter:title"]', 'content', `${docTitle} · FlowFin`);
  set('meta[name="twitter:description"]', 'content', docDescription);
}

const APP_LANDING = (typeof globalThis !== 'undefined' && globalThis.location?.origin) || 'https://app.flowfin.com';

function fmtMoney(n, currency = 'MXN') {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString('es-MX')}`;
  }
}

export default function PublicSnapshotPage() {
  const { slug } = useParams();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [snap, setSnap] = useState(null);

  useEffect(() => {
    if (!slug) {
      setStatus('error');
      setError('not_found');
      return;
    }
    let cancelled = false;
    base44.functions.invoke('getPublicSnapshot', { slug })
      .then((res) => {
        if (cancelled) return;
        const data = res?.data;
        if (data?.error || !data?.snapshot) {
          setError(data?.error || 'not_found');
          setStatus('error');
          return;
        }
        setSnap(data.snapshot);
        setStatus('ready');
        const copy = COPY[data.snapshot.type] || COPY.goal_achieved;
        applyDocumentMeta({
          docTitle: copy.docTitle || 'Snapshot FlowFin',
          docDescription: copy.docDescription || 'Resumen compartido desde FlowFin.',
        });
        track('snapshot_viewed', {
          type: data.snapshot.type,
          slug,
          referrer: typeof document !== 'undefined' ? document.referrer : '',
        });
      })
      .catch(() => {
        if (cancelled) return;
        setError('network');
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [slug]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="w-16 h-16 rounded-3xl bg-primary/15 animate-pulse" />
      </div>
    );
  }

  if (status === 'error') {
    const msg = error === 'expired'
      ? 'Este resumen ya expiró.'
      : error === 'hidden'
        ? 'Este resumen ya no está disponible.'
        : 'No encontramos este resumen.';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-8 text-center gap-4">
        <p className="text-base font-semibold">{msg}</p>
        <a
          href={APP_LANDING}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25"
        >
          Conocer FlowFin
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  const copy = COPY[snap.type] || COPY.goal_achieved;
  const Icon = copy.icon;

  const handleCta = () => {
    track('snapshot_cta_clicked', { type: snap.type, slug });
    globalThis.open?.(APP_LANDING, '_blank', 'noopener');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className={`min-h-screen bg-gradient-to-b ${copy.color} flex flex-col`}>
        <header className="px-5 pt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black text-base shadow-sm">F</div>
            <span className="font-black text-sm">FlowFin</span>
          </div>
          <a
            href={APP_LANDING}
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >Crear el mío →</a>
        </header>

        <motion.main
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
              <Icon className="w-5 h-5" aria-hidden="true" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{copy.title}</p>
          </div>

          {snap.type === 'goal_achieved' && <GoalAchievedTemplate payload={snap.payload_json} />}
          {snap.type === 'trip_summary' && <TripSummaryTemplate payload={snap.payload_json} />}
          {snap.type === 'monthly_report' && <MonthlyReportTemplate payload={snap.payload_json} />}
          {snap.type === 'budget_kept' && <BudgetKeptTemplate payload={snap.payload_json} />}

          <button
            type="button"
            onClick={handleCta}
            className="mt-10 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors"
          >
            {copy.cta}
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground text-center">Privado por diseño · Sin nombres reales</p>
        </motion.main>

        <footer className="px-5 py-6 text-center text-[10px] text-muted-foreground">
          {snap.views ? `${snap.views} vistas` : ''}
        </footer>
      </div>
    </div>
  );
}

function GoalAchievedTemplate({ payload }) {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl sm:text-4xl font-black leading-tight">{payload?.goal_name || 'Mi meta'}</h1>
      <p className="text-sm text-muted-foreground">Llegué al objetivo</p>
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Monto alcanzado</p>
        <p className="text-5xl font-black text-foreground">{fmtMoney(payload?.amount, payload?.currency)}</p>
        {payload?.days_to_complete ? (
          <p className="text-xs text-muted-foreground mt-3">En {payload.days_to_complete} días</p>
        ) : null}
      </div>
      {payload?.contributors ? (
        <p className="text-xs text-muted-foreground">
          {payload.contributors} {payload.contributors === 1 ? 'persona' : 'personas'} aportando
        </p>
      ) : null}
    </div>
  );
}

function TripSummaryTemplate({ payload }) {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl sm:text-4xl font-black leading-tight">{payload?.trip_name || 'Mi viaje'}</h1>
      {payload?.destinations?.length ? (
        <p className="text-sm text-muted-foreground">{payload.destinations.join(' · ')}</p>
      ) : null}
      <div className="rounded-3xl border border-border bg-card p-6 space-y-3">
        <Row label="Total gastado" value={fmtMoney(payload?.total_spent, payload?.currency)} />
        {payload?.days ? <Row label="Duración" value={`${payload.days} días`} /> : null}
        {payload?.participants ? <Row label="Participantes" value={`${payload.participants}`} /> : null}
        {payload?.budget_amount ? (
          <Row
            label="Presupuesto"
            value={`${fmtMoney(payload.budget_amount, payload?.currency)} (${Math.round(((payload.total_spent || 0) / payload.budget_amount) * 100)}%)`}
          />
        ) : null}
      </div>
    </div>
  );
}

function MonthlyReportTemplate({ payload }) {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl sm:text-4xl font-black leading-tight">{payload?.month_label || 'Mi mes'}</h1>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Ingresos" value={fmtMoney(payload?.total_income, payload?.currency)} />
        <Stat label="Gastos" value={fmtMoney(payload?.total_expense, payload?.currency)} />
      </div>
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Top categorías</p>
        <ul className="space-y-2">
          {(payload?.top_categories || []).slice(0, 4).map((row) => (
            <li key={row.label} className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground truncate pr-2">{row.label}</span>
              <span className="font-mono text-muted-foreground">{fmtMoney(row.amount, payload?.currency)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BudgetKeptTemplate({ payload }) {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl sm:text-4xl font-black leading-tight">{payload?.streak_months || 1} {payload?.streak_months === 1 ? 'mes' : 'meses'} dentro del presupuesto</h1>
      <p className="text-sm text-muted-foreground">{payload?.tagline || 'Sin pasarme del límite que me puse.'}</p>
      {payload?.savings_pct ? (
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Ahorro promedio</p>
          <p className="text-5xl font-black text-foreground">{payload.savings_pct}%</p>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-black text-foreground mt-1">{value}</p>
    </div>
  );
}
