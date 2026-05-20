import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Mail, Loader2, CheckCircle, Clock, Award, Search, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import PageHeader from '@/components/PageHeader';
import { useToast } from '@/components/ui/use-toast';

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function WaitlistAdmin() {
  const { currentUser } = useFamily();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [onlyPending, setOnlyPending] = useState(true);
  const [selected, setSelected] = useState(() => new Set());

  const isPlatformAdmin = currentUser?.role === 'admin';

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['waitlist-admin', onlyPending],
    queryFn: async () => {
      const res = await base44.functions.invoke('listWaitlist', { only_pending: onlyPending, limit: 500 });
      if (res?.data?.error) throw new Error(res.data.error);
      return res?.data;
    },
    enabled: isPlatformAdmin,
    staleTime: 60 * 1000,
  });

  const rows = data?.rows || [];
  const totals = useMemo(() => ({
    total: data?.total || 0,
    pending: data?.pending || 0,
    invited: data?.invited || 0,
    joined: data?.joined || 0,
  }), [data]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const email = String(r.email || '').toLowerCase();
      const code = String(r.self_code || '').toLowerCase();
      const source = String(r.source || '').toLowerCase();
      return email.includes(q) || code.includes(q) || source.includes(q);
    });
  }, [rows, search]);

  const inviteMutation = useMutation({
    mutationFn: async (ids) => {
      const res = await base44.functions.invoke('markWaitlistInvited', { ids });
      if (res?.data?.error) throw new Error(res.data.error);
      return res?.data;
    },
    onSuccess: (result) => {
      const n = result?.invited || 0;
      toast({
        title: n > 0 ? `${n} invitado${n > 1 ? 's' : ''}` : 'Nada que invitar',
        description: 'invited_at actualizado en Base44.',
      });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['waitlist-admin'] });
    },
    onError: (err) => {
      toast({
        title: 'Error al invitar',
        description: err?.message || 'Intenta de nuevo.',
        variant: 'destructive',
      });
    },
  });

  if (!isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Panel interno ACACIA — acceso restringido.</p>
      </div>
    );
  }

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectTopN = (n) => {
    const next = new Set();
    filteredRows.slice(0, n).forEach((r) => { if (!r.invited_at) next.add(r.id); });
    setSelected(next);
  };

  const handleInvite = () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    inviteMutation.mutate(ids);
  };

  return (
    <div className="pb-12">
      <PageHeader title="Waitlist" subtitle="Panel interno ACACIA · pre-lanzamiento" />

      <div className="px-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Total" value={totals.total} icon={Mail} />
        <Metric label="Pendientes" value={totals.pending} icon={Clock} />
        <Metric label="Invitados" value={totals.invited} icon={CheckCircle} accent="text-emerald-600" />
        <Metric label="Cuenta creada" value={totals.joined} icon={Award} accent="text-primary" />
      </div>

      <div className="px-4 flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar email, código o source"
            className="flex-1 text-sm bg-transparent outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyPending((v) => !v)}
          className={`px-3 py-2 text-xs font-semibold rounded-xl border ${onlyPending ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'}`}
        >
          {onlyPending ? 'Pendientes' : 'Todos'}
        </button>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-2 py-2 rounded-xl border border-border bg-card text-muted-foreground disabled:opacity-50"
          title="Refrescar"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-4 flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Atajos</span>
        {[10, 25, 50, 100].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => selectTopN(n)}
            className="text-[11px] font-semibold px-3 py-1 rounded-full bg-muted text-foreground hover:bg-muted/70"
          >Top {n}</button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">Seleccionados: <span className="font-bold text-foreground">{selected.size}</span></span>
        <button
          type="button"
          onClick={handleInvite}
          disabled={!selected.size || inviteMutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm disabled:opacity-50"
        >
          {inviteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
          Marcar invitados
        </button>
      </div>

      <div className="px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando waitlist…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm">
            <Mail className="w-8 h-8 mb-2" />
            Sin registros que coincidan.
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {filteredRows.map((row, idx) => {
              const isSelected = selected.has(row.id);
              const rank = idx + 1;
              return (
                <button
                  type="button"
                  key={row.id}
                  onClick={() => !row.invited_at && toggleSelect(row.id)}
                  disabled={Boolean(row.invited_at)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors ${isSelected ? 'bg-primary/5' : ''} ${row.invited_at ? 'opacity-70 cursor-default' : ''}`}
                >
                  <span className="w-7 text-center text-[11px] font-bold text-muted-foreground">#{rank}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground truncate">{row.email}</span>
                      {row.source && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">{row.source}</span>
                      )}
                      {row.invited_at && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold">INVITADO</span>
                      )}
                      {row.joined_app_user_id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-bold">CUENTA</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                      <span>code <span className="font-mono text-foreground">{row.self_code || '—'}</span></span>
                      {row.referrer_code ? <span>← <span className="font-mono">{row.referrer_code}</span></span> : null}
                      <span>{fmtDate(row.created_date)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-foreground leading-none">{row.referrals_count || 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">refs</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, accent }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className={`w-3 h-3 ${accent || ''}`} />
        {label}
      </div>
      <p className={`text-2xl font-black mt-1 ${accent || 'text-foreground'}`}>{value}</p>
    </div>
  );
}
