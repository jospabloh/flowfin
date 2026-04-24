/**
 * AIUsage.jsx
 * Settings sub-page: monthly AI cost + scan history for the family.
 * Route: /AIUsage
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import { Zap, Clock, DollarSign } from 'lucide-react';

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------
const STRINGS = {
  'es-MX': {
    title: 'Consumo de IA',
    subtitle: 'Historial de escaneos y costo de API',
    mtdCost: 'Costo del mes',
    scansThisMonth: 'Escaneos del mes',
    avgLatency: 'Latencia promedio',
    recentScans: 'Escaneos recientes',
    noScans: 'Sin escaneos todavía.',
    filters: {
      thisWeek: 'Esta semana',
      thisMonth: 'Este mes',
      last30: 'Últimos 30 días',
    },
    tokens: 'tokens',
    latencyMs: 'ms',
    loading: 'Cargando…',
    errorLoad: 'No se pudo cargar el historial.',
  },
  'en-US': {
    title: 'AI Usage',
    subtitle: 'Scan history and API cost',
    mtdCost: 'Month-to-date cost',
    scansThisMonth: 'Scans this month',
    avgLatency: 'Avg latency',
    recentScans: 'Recent scans',
    noScans: 'No scans yet.',
    filters: {
      thisWeek: 'This week',
      thisMonth: 'This month',
      last30: 'Last 30 days',
    },
    tokens: 'tokens',
    latencyMs: 'ms',
    loading: 'Loading…',
    errorLoad: 'Could not load history.',
  },
};

function getStrings(locale) {
  if (!locale) return STRINGS['es-MX'];
  return locale.startsWith('en') ? STRINGS['en-US'] : STRINGS['es-MX'];
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function startOfThisWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfThisMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfLast30Days() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const FILTER_STARTS = {
  thisWeek: startOfThisWeek,
  thisMonth: startOfThisMonth,
  last30: startOfLast30Days,
};

// ---------------------------------------------------------------------------
// StatCard sub-component
// ---------------------------------------------------------------------------
function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AIUsage() {
  const { familyId, familyConfig, currentUser } = useFamily();

  const locale = familyConfig?.locale || 'es-MX';
  const s = getStrings(locale);

  const [filter, setFilter] = useState('thisMonth');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!familyId) return;
    setLoading(true);
    setError(null);

    base44.entities.AssistantUsage.filter({ family_id: familyId }, '-created_at', 100).then((data) => {
      setRows(data || []);
      setLoading(false);
    }).catch((err) => {
      console.error('AIUsage load error:', err);
      setError(s.errorLoad);
      setLoading(false);
    });
  }, [familyId]);

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-sm text-muted-foreground">Acceso restringido.</p>
      </div>
    );
  }

  // Client-side filter by date range.
  const cutoff = FILTER_STARTS[filter]();
  const filtered = rows.filter((r) => (r.created_at ?? '') >= cutoff);

  // Aggregate stats.
  const mtdCost = filtered.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0);
  const scanCount = filtered.length;
  const avgLatency = scanCount
    ? Math.round(filtered.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0) / scanCount)
    : 0;

  const formatCost = (usd) =>
    usd < 0.001 ? `$${(usd * 1000).toFixed(3)} m` : `$${usd.toFixed(4)}`;

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="pb-4">
      <PageHeader title={s.title} subtitle={s.subtitle} />

      {/* Filter tabs */}
      <div className="px-4 flex gap-2 mb-4">
        {Object.entries(s.filters).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-4">
        {/* Stats cards */}
        <div className="grid grid-cols-1 gap-3">
          <StatCard
            icon={DollarSign}
            label={s.mtdCost}
            value={loading ? s.loading : formatCost(mtdCost)}
            accent="bg-primary/10 text-primary"
          />
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Zap}
              label={s.scansThisMonth}
              value={loading ? '…' : String(scanCount)}
              accent="bg-income/10 text-income"
            />
            <StatCard
              icon={Clock}
              label={s.avgLatency}
              value={loading ? '…' : `${avgLatency} ${s.latencyMs}`}
              accent="bg-muted text-muted-foreground"
            />
          </div>
        </div>

        {/* Scan history list */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">{s.recentScans}</h3>

          {loading && (
            <div className="text-center py-8 text-muted-foreground text-sm">{s.loading}</div>
          )}

          {error && !loading && (
            <div className="text-center py-8 text-destructive text-sm">{error}</div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">{s.noScans}</div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-2">
              {filtered.slice(0, 30).map((row, i) => (
                <motion.div
                  key={row.id ?? i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {row.model ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(row.created_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.tokens_in ?? 0} in / {row.tokens_out ?? 0} out {s.tokens}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      {formatCost(row.cost_usd ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.latency_ms ?? 0} {s.latencyMs}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}