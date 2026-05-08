import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { formatDate as fmtDateUtil } from '@/lib/formatters';
import PageHeader from '@/components/PageHeader';
import {
  Search, Shield, CheckCircle, AlertCircle, Clock,
  X, Loader2, ChevronRight, Users, Calendar, Mail,
  RefreshCw, ToggleLeft, ToggleRight, CreditCard, DollarSign,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const PLAN_OPTIONS = [
  { value: 'home', label: 'FlowFin Home', limit: 4, price: '$299 MXN/mes', desc: 'De 1 a 4 miembros' },
  { value: 'family_plus', label: 'FlowFin Family+', limit: 10, price: '$499 MXN/mes', desc: 'De 5 a 10 miembros' },
];

const STATUS_CONFIG = {
  trial:     { label: 'Prueba',       color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',          icon: Clock },
  active:    { label: 'Activo',        color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30', icon: CheckCircle },
  view_only: { label: 'Solo lectura',  color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',       icon: AlertCircle },
  suspended: { label: 'Suspendido',    color: 'text-red-600 bg-red-50 dark:bg-red-950/30',             icon: AlertCircle },
};

const TEST_EMAIL = 'h.jospablo@gmail.com';

// Current billing period helper: YYYY-MM
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Family-only read-only view ───────────────────────────────────────────────
function FamilyLicenseView() {
  const {
    family, isAdmin, billingStatus, licensePlan, licensedMemberLimit,
    trialDaysLeft, activeMemberCount, trialStartAt, trialEndAt,
    licenseActivatedAt, licenseExpiresAt,
  } = useFamily();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Acceso restringido.</p>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[billingStatus] || STATUS_CONFIG.trial;
  const StatusIcon = cfg.icon;
  const planLabel = PLAN_OPTIONS.find(p => p.value === licensePlan)?.label || licensePlan || '—';

  return (
    <div className="pb-8">
      <PageHeader
        title="Mi Licencia"
        subtitle={family?.name || 'Información de tu plan'}
        icon={<CreditCard className="w-5 h-5" />}
      />

      <div className="px-4 space-y-4 max-w-lg mx-auto">
        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${cfg.color} border-current/20`}>
          <StatusIcon className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold">Estado: {cfg.label}</p>
            {billingStatus === 'trial' && trialDaysLeft !== null && (
              <p className="text-xs mt-0.5">
                {trialDaysLeft > 0
                  ? `Quedan ${trialDaysLeft} días de prueba`
                  : 'El período de prueba ha terminado'}
              </p>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detalles del plan</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Plan</p>
              <p className="text-sm font-bold text-foreground">{planLabel}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Miembros</p>
              <p className="text-sm font-bold text-foreground">
                {activeMemberCount ?? '—'} <span className="font-normal text-muted-foreground">/ {licensedMemberLimit}</span>
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {trialStartAt && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Inicio de prueba
                </span>
                <span className="font-medium text-foreground">{fmtDateUtil(trialStartAt)}</span>
              </div>
            )}
            {trialEndAt && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Fin de prueba
                </span>
                <span className="font-medium text-foreground">{fmtDateUtil(trialEndAt)}</span>
              </div>
            )}
            {licenseActivatedAt && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Licencia activada
                </span>
                <span className="font-medium text-foreground">{fmtDateUtil(licenseActivatedAt)}</span>
              </div>
            )}
            {licenseExpiresAt && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Vence
                </span>
                <span className="font-medium text-foreground">{fmtDateUtil(licenseExpiresAt)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-muted/40 rounded-2xl px-4 py-3 border border-border">
          <p className="text-[11px] text-muted-foreground text-center">
            Tu suscripción se gestiona vía Mercado Pago. Para cambios en tu plan, contacta al soporte de FlowFin.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Internal Platform Admin panel ────────────────────────────────────────────
export default function LicenseAdmin() {
  const { currentUser } = useFamily();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [testEmailSending, setTestEmailSending] = useState(false);

  // General license edit form (activateLicense — for status/plan adjustments)
  const [form, setForm] = useState({
    billing_status: 'active',
    license_plan: 'home',
    licensed_member_limit: 4,
    payment_reference: '',
    activation_notes: '',
    license_expires_at: '',
    auto_renewal: false,
  });

  // Payment confirmation form (confirmLicensePayment)
  const [payForm, setPayForm] = useState({
    payment_period: currentPeriod(),
    payment_reference: '',
    payment_notes: '',
    license_plan: 'home',
    license_expires_at: '',
    auto_renewal: false,
  });

  const isAppAdmin = currentUser?.role === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['familyBillingAdmin', search],
    queryFn: () => base44.functions.invoke('getFamilyBillingStatus', { search }).then(r => r.data),
    enabled: isAppAdmin,
    staleTime: 20 * 1000,
  });

  // General license edit
  const activateMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('activateLicense', payload),
    onSuccess: () => {
      toast({ title: '✅ Licencia actualizada', duration: 4000 });
      queryClient.invalidateQueries({ queryKey: ['familyBillingAdmin'] });
      setSelectedFamily(null);
    },
    onError: (err) => {
      toast({ title: 'Error al actualizar', description: err?.message, variant: 'destructive' });
    },
  });

  // Payment confirmation
  const confirmPaymentMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('confirmLicensePayment', payload),
    onSuccess: (res) => {
      const d = res?.data ?? res;
      toast({
        title: '✅ Pago confirmado y licencia actualizada',
        description: `Plan: ${d?.license_plan || ''} · Vence: ${d?.license_expires_at ? fmt(d.license_expires_at) : '—'}`,
        duration: 6000,
      });
      queryClient.invalidateQueries({ queryKey: ['familyBillingAdmin'] });
      setSelectedFamily(null);
    },
    onError: (err) => {
      toast({ title: 'Error al confirmar pago', description: err?.message, variant: 'destructive' });
    },
  });

  const handleSendTestEmails = async () => {
    setTestEmailSending(true);
    try {
      const result = await base44.functions.invoke('sendTestEmails', {});
      const r = result?.data ?? result;
      toast({
        title: '✅ Correos de prueba enviados',
        description: `${r?.sent ?? '?'} enviados, ${r?.failed ?? 0} fallidos → ${TEST_EMAIL}`,
        duration: 6000,
      });
    } catch (err) {
      toast({ title: 'Error al enviar correos de prueba', description: err?.message, variant: 'destructive' });
    } finally {
      setTestEmailSending(false);
    }
  };

  if (!isAppAdmin) return <FamilyLicenseView />;

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
      auto_renewal: f.auto_renewal ?? false,
    });
    setPayForm({
      payment_period: currentPeriod(),
      payment_reference: f.payment_reference || '',
      payment_notes: '',
      license_plan: f.license_plan || 'home',
      license_expires_at: '',
      auto_renewal: f.auto_renewal ?? false,
    });
  };

  const handleActivate = () => {
    if (!selectedFamily) return;
    activateMutation.mutate({
      family_id: selectedFamily.id,
      billing_status: form.billing_status,
      license_plan: payForm.license_plan,
      licensed_member_limit: PLAN_OPTIONS.find(p => p.value === payForm.license_plan)?.limit || 4,
      payment_reference: form.payment_reference || undefined,
      activation_notes: form.activation_notes || undefined,
      license_expires_at: form.license_expires_at || undefined,
      auto_renewal: payForm.auto_renewal,
    });
  };

  const handleConfirmPayment = () => {
    if (!selectedFamily) return;
    confirmPaymentMutation.mutate({
      family_id: selectedFamily.id,
      license_plan: payForm.license_plan,
      payment_reference: payForm.payment_reference || undefined,
      payment_period: payForm.payment_period,
      payment_notes: payForm.payment_notes || undefined,
      license_expires_at: payForm.license_expires_at || undefined,
      auto_renewal: payForm.auto_renewal,
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

        {/* Test emails button */}
        <div className="flex items-center justify-between px-3 py-3 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">Correos de prueba</p>
              <p className="text-[11px] text-muted-foreground">Envía las plantillas de automatización a {TEST_EMAIL}</p>
            </div>
          </div>
          <button
            onClick={handleSendTestEmails}
            disabled={testEmailSending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 flex-shrink-0"
          >
            {testEmailSending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
              : <><Mail className="w-3.5 h-3.5" /> Enviar test</>
            }
          </button>
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
                      {f.auto_renewal && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">
                          <RefreshCw className="w-2.5 h-2.5" />
                          MP
                        </span>
                      )}
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
                    <span>Plan: <span className="font-medium text-foreground">{PLAN_OPTIONS.find(p => p.value === f.license_plan)?.label || f.license_plan || '—'}</span></span>
                    {daysLeft !== null && (
                      <span className={daysLeft <= 7 ? 'text-orange-500 font-semibold' : ''}>
                        {daysLeft}d restantes
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground/80 mt-1">
                    <span>ID: <span className="font-mono text-foreground/80 break-all">{f.id}</span></span>
                    {f.creator_email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        <span className="text-foreground/80">{f.creator_email}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-[11px] text-muted-foreground/70 mt-1">
                    <span>Inicio trial: {fmt(f.trial_start_at)}</span>
                    <span>Fin trial: {fmt(f.trial_end_at)}</span>
                    {f.license_activated_at && <span>Activado: {fmt(f.license_activated_at)}</span>}
                    {f.license_expires_at && (
                      <span>Vence: <span className="font-medium text-foreground">{fmt(f.license_expires_at)}</span></span>
                    )}
                    {f.last_payment_period && (
                      <span>Último pago: <span className="font-medium text-foreground">{f.last_payment_period}</span></span>
                    )}
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

      {/* Modal */}
      {selectedFamily && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setSelectedFamily(null)} />
          <div
            className="fixed inset-x-4 top-[3%] z-[51] max-w-md mx-auto bg-card rounded-3xl border border-border shadow-2xl overflow-y-auto hide-scrollbar"
            style={{ maxHeight: '94vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <div className="min-w-0 pr-2">
                <h3 className="font-bold text-foreground truncate">{selectedFamily.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono">{selectedFamily.join_code}</span>
                  {selectedFamily.license_expires_at && (
                    <> · Vence: <span className="font-medium text-foreground">{fmt(selectedFamily.license_expires_at)}</span></>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  ID: <span className="font-mono text-foreground/80 break-all">{selectedFamily.id}</span>
                </p>
                {selectedFamily.creator_email && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Creada por: <span className="text-foreground/90">{selectedFamily.creator_email}</span>
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedFamily(null)} className="p-1.5 rounded-xl bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-6">

              {/* ── SECTION 1: Confirmar pago recibido ─────────────────────── */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Confirmación de pago</h4>
                </div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 -mt-2">
                  Confirma el pago recibido en Mercado Pago. FlowFin actualizará la licencia y enviará correo de confirmación.
                </p>

                {/* Payment period */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Período de pago (YYYY-MM)</label>
                  <input
                    value={payForm.payment_period}
                    onChange={e => setPayForm(f => ({ ...f, payment_period: e.target.value }))}
                    placeholder="2026-05"
                    className="w-full bg-white dark:bg-card border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Plan */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-2 block">Plan</label>
                  <div className="space-y-2">
                    {PLAN_OPTIONS.map(p => (
                      <button key={p.value}
                        onClick={() => setPayForm(f => ({ ...f, license_plan: p.value }))}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${
                          payForm.license_plan === p.value
                            ? 'bg-primary/10 border-primary text-primary font-semibold'
                            : 'bg-white dark:bg-card border-transparent text-foreground hover:bg-muted/70'
                        }`}>
                        <div className="text-left">
                          <p className="font-semibold text-sm">{p.label}</p>
                          <p className="text-[11px] text-muted-foreground">{p.desc}</p>
                        </div>
                        <span className={`text-xs font-bold ${payForm.license_plan === p.value ? 'text-primary' : 'text-muted-foreground'}`}>{p.price}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment reference */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Referencia de pago (Mercado Pago)</label>
                  <input
                    value={payForm.payment_reference}
                    onChange={e => setPayForm(f => ({ ...f, payment_reference: e.target.value }))}
                    placeholder="ID transacción, folio, nota..."
                    className="w-full bg-white dark:bg-card border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Notas internas ACACIA</label>
                  <input
                    value={payForm.payment_notes}
                    onChange={e => setPayForm(f => ({ ...f, payment_notes: e.target.value }))}
                    placeholder="Observaciones del pago..."
                    className="w-full bg-white dark:bg-card border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* License expiry override (optional) */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5 block">
                    <Calendar className="w-3.5 h-3.5" />
                    Vencimiento de licencia (dejar vacío = +1 mes automático)
                  </label>
                  <input
                    type="date"
                    value={payForm.license_expires_at}
                    onChange={e => setPayForm(f => ({ ...f, license_expires_at: e.target.value }))}
                    className="w-full bg-white dark:bg-card border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Mercado Pago subscription toggle */}
                <div>
                  <button
                    onClick={() => setPayForm(f => ({ ...f, auto_renewal: !f.auto_renewal }))}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                      payForm.auto_renewal
                        ? 'bg-emerald-100 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                        : 'bg-white dark:bg-card border-transparent bg-muted'
                    }`}
                  >
                    <div className="text-left">
                      <p className={`text-sm font-semibold ${payForm.auto_renewal ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {payForm.auto_renewal ? 'Suscripción Mercado Pago activa ✓' : 'Sin suscripción Mercado Pago'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        El cobro se gestiona en Mercado Pago. La renovación de acceso en FlowFin se confirma manualmente por ACACIA.
                      </p>
                    </div>
                    {payForm.auto_renewal
                      ? <ToggleRight className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                      : <ToggleLeft className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                    }
                  </button>
                </div>

                <button
                  onClick={handleConfirmPayment}
                  disabled={confirmPaymentMutation.isPending || !payForm.payment_period}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 min-h-[52px] transition-colors"
                >
                  {confirmPaymentMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando...</>
                    : <><CheckCircle className="w-4 h-4" /> Confirmar pago recibido</>
                  }
                </button>
              </div>

              {/* ── SECTION 2: Ajuste general de licencia ──────────────────── */}
              <div className="border border-border rounded-2xl p-4 space-y-4">
                <h4 className="text-sm font-bold text-foreground">Ajuste general de licencia</h4>
                <p className="text-[11px] text-muted-foreground -mt-2">
                  Cambia el estado o datos administrativos sin confirmar un pago específico.
                </p>

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
          </div>
        </>
      )}
    </div>
  );
}