/**
 * AIUsage.jsx
 * Settings sub-page: monthly AI cost + scan history for the family.
 * Now includes per-person breakdown so admins can see who is consuming the AI quota.
 * Route: /AIUsage
 */

import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import { Zap, Clock, DollarSign, User } from 'lucide-react';

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------
const STRINGS = {
  'es-MX': {
    title: 'Consumo de IA',
    subtitle: 'Historial de escaneos y costo por usuario',
    mtdCost: 'Costo del periodo',
    scansThisMonth: 'Escaneos',
    avgLatency: 'Latencia promedio',
    recentScans: 'Escaneos recientes',
    noScans: 'Sin escaneos en este periodo.',
    byUser: 'Consumo por usuario',
    allUsers: 'Todos los usuarios',
    unknownUser: 'Sin asignar',
    filters: { thisWeek: 'Esta semana', thisMonth: 'Este mes', last30: 'Últimos 30 días' },
    tokens: 'tokens',
    latencyMs: 'ms',
    loading: 'Cargando…',
    errorLoad: 'No se pudo cargar el historial.',
  },
  'en-US': {
    title: 'AI Usage',
    subtitle: 'Scan history and cost per user',
    mtdCost: 'Period cost',
    scansThisMonth: 'Scans',
    avgLatency: 'Avg latency',
    recentScans: 'Recent scans',
    noScans: 'No scans in this period.',
    byUser: 'Usage per user',
    allUsers: 'All users',
    unknownUser: 'Unassigned',
    filters: { thisWeek: 'This week', thisMonth: 'This month', last30: 'Last 30 days' },
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
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
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
  const [personFilter, setPersonFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!familyId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      base44.entities.AssistantUsage.filter({ family_id: familyId }, '-created_at', 500),
      base44.entities.Person.filter({ family_id: familyId }),
    ])
      .then(([usage, ppl]) => {
        setRows(usage || []);
        setPersons(ppl || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('AIUsage load error:', err);
        setError(s.errorLoad);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  // Person lookup map (id → name)
  const personMap = useMemo(() => {
    const m = {};
    for (const p of persons) m[p.id] = p.name || s.unknownUser;
    return m;
  }, [persons, s.unknownUser]);

  // Client-side filter by date + person. (computed before any early return to keep hook order stable)
  const cutoff = FILTER_STARTS[filter]();
  const filtered = useMemo(
    () => rows.filter((r) => {
      if ((r.created_at ?? '') < cutoff) return false;
      if (personFilter !== 'all' && r.person_id !== personFilter) return false;
      return true;
    }),
    [rows, cutoff, personFilter]
  );

  // Aggregate by person for the breakdown card
  const perPerson = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const key = r.person_id || '__unassigned__';
      const cur = map.get(key) || { person_id: key, cost: 0, scans: 0 };
      cur.cost += r.cost_usd ?? 0;
      cur.scans += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [filtered]);

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-sm text-muted-foreground">Acceso restringido.</p>
      </div>
    );
  }

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
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const personName = (pid) => personMap[pid] || s.unknownUser;

  return (
    <div className="pb-4">
      <PageHeader title={s.title} subtitle={s.subtitle} />

      {/* Filter tabs */}
      <div className="px-4 flex gap-2 mb-3 flex-wrap">
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

      {/* Person filter */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <select
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            className="flex-1 bg-muted text-foreground rounded-xl px-3 py-2 text-xs font-medium border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">{s.allUsers}</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
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

        {/* Per-user breakdown */}
        {!loading && !error && perPerson.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">{s.byUser}</h3>
            <div className="space-y-2">
              {perPerson.map((row) => {
                const pct = mtdCost > 0 ? Math.round((row.cost / mtdCost) * 100) : 0;
                return (
                  <div
                    key={row.person_id}
                    className="bg-card border border-border rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {row.person_id === '__unassigned__' ? s.unknownUser : personName(row.person_id)}
                      </p>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-foreground">{formatCost(row.cost)}</p>
                        <p className="text-[10px] text-muted-foreground">{row.scans} {s.scansThisMonth.toLowerCase()}</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
              {filtered.slice(0, 50).map((row, i) => (
                <motion.div
                  key={row.id ?? i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 20) * 0.02 }}
                  className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {row.model ?? '—'}
                    </p>
                    <p className="text-[11px] text-primary truncate font-medium">
                      {row.person_id ? personName(row.person_id) : s.unknownUser}
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