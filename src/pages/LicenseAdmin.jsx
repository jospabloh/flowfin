import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import PageHeader from '@/components/PageHeader';
import {
  Search, Shield, CheckCircle, AlertCircle, Clock,
  X, Loader2, ChevronRight, Users, Calendar,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const PLAN_OPTIONS = [
  { value: 'home', label: 'FlowFin Home', limit: 4 },
  { value: 'family_plus', label: 'FlowFin Family+', limit: 10 },
  { value: 'circle', label: 'FlowFin Circle', limit: 20 },
];

const STATUS_CONFIG = {
  trial:     { label: 'Prueba',       color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',       icon: Clock },
  active:    { label: 'Activo',        color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30', icon: CheckCircle },
  view_only: { label: 'Solo lectura',  color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',    icon: AlertCircle },
  suspended: { label: 'Suspendido',    color: 'text-red-600 bg-red-50 dark:bg-red-950/30',          icon: AlertCircle },
};

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LicenseAdmin() {
  const { currentUser } = useFamily();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [form, setForm] = useState({
    billing_status: 'active',
    license_plan: 'home',
    licensed_member_limit: 4,
    payment_reference: '',
    activation_notes: '',
    license_expires_at: '',
  });

  const isAppAdmin = currentUser?.role === 'admin';

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['familyBillingAdmin', search],
    queryFn: () => base44.functions.invoke('getFamilyBillingStatus', { search }).then(r => r.data),
    enabled: isAppAdmin,
    staleTime: 20 * 1000,
  });

  const activateMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('activateLicense', payload),
    onSuccess: () => {
      toast({ title: '✅ Licencia actualizada', duration: 4000 });
      queryClient.invalidateQueries({ queryKey: ['familyBillingAdmin'] });
      setSelectedFamily(null);
    },
    onError: (err) => {
      toast({ title: 'Error al activar', description: err?.message, variant: 'destructive' });
    },
  });

  if (!isAppAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Acceso restringido a administradores del sistema.</p>
      </div>
    );
  }

  const families = data?.families || [];

  const handleSelectFamily = (f) => {
    setSelectedFamily(f);
    setForm({
      billing_status: f.billing_status || 'trial',
      license_plan: f.license_plan || 'home',
      licensed_member_limit: f.licensed_member_limit || 4,
      payment_reference: f.payment_reference || '',
      activation_notes: '',
      license_expires_at: f.license_expires_at ? f.license_expires_at.slice(0, 10) : '',
    });
  };

  const handleActivate = () => {
    if (!selectedFamily) return;
    activateMutation.mutate({
      family_id: selectedFamily.id,
      billing_status: form.billing_status,
      license_plan: form.license_plan,
      licensed_member_limit: form.licensed_member_limit,
      payment_reference: form.payment_reference || undefined,
      activation_notes: form.activation_notes || undefined,
      license_expires_at: form.license_expires_at || undefined,
    });
  };

  return (
    <div className="pb-8">
      <PageHeader title="Licencias FlowFin" subtitle="Panel interno ACACIA" />

      <div className="px-4 space-y-4">
        {/* System admin badge */}
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            Panel interno — ACACIA Consultoría · Solo administradores del sistema
          </p>
        </div>

        {/* Stats summary */}
        {!isLoading && families.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {(['trial', 'active', 'view_only', 'suspended']).map(s => {
              const count = families.filter(f => (f.billing_status || 'trial') === s).length;
              const cfg = STATUS_CONFIG[s];
              return (
                <div key={s} className={`rounded-xl p-2.5 text-center ${cfg.color}`}>
                  <p className="text-xl font-black">{count}</p>
                  <p className="text-[10px] font-semibold">{cfg.label}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código o ID..."
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Families list */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : families.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No se encontraron familias.</p>
        ) : (
          <div className="space-y-2">
            {families.map(f => {
              const cfg = STATUS_CONFIG[f.billing_status || 'trial'] || STATUS_CONFIG.trial;
              const StatusIcon = cfg.icon;
              const daysLeft = f.trial_end_at && f.billing_status === 'trial'
                ? Math.max(0, Math.ceil((new Date(f.trial_end_at) - new Date()) / 86400000))
                : null;
              return (
                <button
                  key={f.id}
                  onClick={() => handleSelectFamily(f)}
                  className="w-full text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm text-foreground">{f.name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Código: <span className="font-mono font-bold text-foreground">{f.join_code}</span></span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {f.member_count ?? '?'} / {f.licensed_member_limit || 4} miembros
                    </span>
                    <span>Plan: <span className="font-medium text-foreground">{f.license_plan || '—'}</span></span>
                    {daysLeft !== null && (
                      <span className={daysLeft <= 7 ? 'text-orange-500 font-semibold' : ''}>
                        {daysLeft}d restantes
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-[11px] text-muted-foreground/70 mt-1">
                    <span>Inicio trial: {fmt(f.trial_start_at)}</span>
                    <span>Fin trial: {fmt(f.trial_end_at)}</span>
                    {f.license_activated_at && <span>Activado: {fmt(f.license_activated_at)}</span>}
                  </div>
                  {f.activation_notes && (
                    <p className="text-[11px] text-muted-foreground mt-1 italic truncate">"{f.activation_notes}"</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Activation modal */}
      {selectedFamily && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setSelectedFamily(null)} />
          <div
            className="fixed inset-x-4 top-[5%] z-[51] max-w-md mx-auto bg-card rounded-3xl border border-border shadow-2xl overflow-y-auto hide-scrollbar"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground">Modificar Licencia</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedFamily.name} · <span className="font-mono">{selectedFamily.join_code}</span>
                </p>
              </div>
              <button onClick={() => setSelectedFamily(null)} className="p-1.5 rounded-xl bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Billing status */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">Estado de facturación</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
                    <button key={s} onClick={() => setForm(f => ({ ...f, billing_status: s }))}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        form.billing_status === s
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/70'
                      }`}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">Plan de licencia</label>
                <div className="space-y-2">
                  {PLAN_OPTIONS.map(p => (
                    <button key={p.value}
                      onClick={() => setForm(f => ({ ...f, license_plan: p.value, licensed_member_limit: p.limit }))}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-all ${
                        form.license_plan === p.value
                          ? 'bg-primary/10 border-primary text-primary font-semibold'
                          : 'bg-muted border-transparent text-foreground hover:bg-muted/70'
                      }`}>
                      <span>{p.label}</span>
                      <span className="text-xs text-muted-foreground">hasta {p.limit} miembros</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment reference */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Referencia de pago</label>
                <input
                  value={form.payment_reference}
                  onChange={e => setForm(f => ({ ...f, payment_reference: e.target.value }))}
                  placeholder="Folio, número de transacción, etc."
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Notas de activación (internas)</label>
                <input
                  value={form.activation_notes}
                  onChange={e => setForm(f => ({ ...f, activation_notes: e.target.value }))}
                  placeholder="Observaciones para el registro interno..."
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Expiry */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5 block">
                  <Calendar className="w-3.5 h-3.5" />
                  Vencimiento de licencia (opcional)
                </label>
                <input
                  type="date"
                  value={form.license_expires_at}
                  onChange={e => setForm(f => ({ ...f, license_expires_at: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <button
                onClick={handleActivate}
                disabled={activateMutation.isPending}
                className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 min-h-[52px]"
              >
                {activateMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  : <><CheckCircle className="w-4 h-4" /> Confirmar cambio</>
                }
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}