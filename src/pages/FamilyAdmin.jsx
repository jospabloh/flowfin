import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { CheckCircle, XCircle, Users, Copy, Check, UserPlus, Loader2, Trash2, X, ShieldCheck, AlertCircle, Link2, DatabaseZap } from 'lucide-react';
import UpgradePlansModal from '@/components/UpgradePlansModal';
import PageHeader from '@/components/PageHeader';
import { useState } from 'react';
import { quotaTone } from '@/lib/quota';
import { useToast } from '@/components/ui/use-toast';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm.jsx';

export default function FamilyAdmin() {
  const { family, familyId, isAdmin, isReadOnly, billingStatus, trialDaysLeft, licensedMemberLimit, currentUser } = useFamily();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const isPlatformAdmin = currentUser?.role === 'admin';

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await base44.functions.invoke('maintenance', { action: 'backfillModulePermissions',});
      const d = res?.data;
      toast({ title: 'Backfill completado', description: d?.message || `${d?.created ?? 0} permisos creados.` });
    } catch (err) {
      toast({ title: 'Error en backfill', description: err?.message, variant: 'destructive' });
    } finally {
      setBackfilling(false);
    }
  };
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const { confirmDelete, ConfirmDialog } = useDeleteConfirm();
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);

  const { data: memberships = [] } = useQuery({
    queryKey: ['memberships', familyId],
    // Server-side read (not a direct entity filter): the RLS branch this
    // used to rely on (`data.family_id: {{user.data.family_id}}`) does not
    // reliably match for the family's own admin — see listMemberships.ts.
    queryFn: async () => {
      const res = await base44.functions.invoke('family', { action: 'listMemberships', family_id: familyId });
      if (res?.data?.error) throw new Error(res.data.error);
      return res?.data?.memberships || [];
    },
    enabled: !!familyId,
    staleTime: 30_000,
  });

  const { data: persons = [] } = useQuery({
    queryKey: ['persons', familyId],
    queryFn: () => base44.entities.Person.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 30_000,
  });

  const linkPersonMutation = useMutation({
    mutationFn: async ({ membershipId, personId }) => {
      const result = await base44.functions.invoke('family', { action: 'linkPersonToMember',
        membership_id: membershipId,
        person_id: personId || null,
        family_id: familyId,
      });
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onMutate: async ({ membershipId, personId }) => {
      await queryClient.cancelQueries({ queryKey: ['memberships', familyId] });
      const previous = queryClient.getQueryData(['memberships', familyId]);
      queryClient.setQueryData(['memberships', familyId], (old = []) =>
        old.map(m => m.id === membershipId ? { ...m, person_id: personId || null } : m)
      );
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['memberships', familyId], ctx.previous);
      toast({ title: 'Error al vincular', description: err?.message || 'No se pudo guardar el vínculo.', variant: 'destructive' });
    },
    onSuccess: (_data, { membershipId, personId }) => {
      queryClient.setQueryData(['memberships', familyId], (old = []) =>
        old.map(m => m.id === membershipId ? { ...m, person_id: personId || null } : m)
      );
      queryClient.invalidateQueries({ queryKey: ['memberships', familyId] });
      toast({ title: 'Vínculo guardado', description: 'El integrante quedó vinculado correctamente.' });
    },
  });

  // Deduplicate by email: keep only the most recent membership per email
  const dedupedMemberships = Object.values(
    memberships.reduce((acc, m) => {
      const key = m.user_email;
      if (!acc[key] || new Date(m.created_date) > new Date(acc[key].created_date)) {
        acc[key] = m;
      }
      return acc;
    }, {})
  );

  const pending = dedupedMemberships.filter(m => m.status === 'pending');
  const approved = dedupedMemberships.filter(m => m.status === 'approved');

  // Approve membership mutation
  const approveMemberMutation = useMutation({
    // El servidor toma a la persona de la membresía guardada y valida el rol
    // contra su lista blanca (member | admin).
    mutationFn: ({ m, role }) => base44.functions.invoke('family', { action: 'approveMember',
      membership_id: m.id,
      family_id: m.family_id,
      role,
    }),
    onMutate: async ({ m, role }) => {
      await queryClient.cancelQueries({ queryKey: ['memberships', familyId] });
      const previous = queryClient.getQueryData(['memberships', familyId]);
      // Optimistic: update membership to approved
      queryClient.setQueryData(['memberships', familyId], (old = []) =>
        old.map(mem => mem.id === m.id ? { ...mem, status: 'approved', role } : mem)
      );
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['memberships', familyId], ctx.previous);
      toast({
        title: 'Error al aprobar',
        description: err?.response?.data?.error || err?.message || 'No se pudo aprobar la solicitud.',
        variant: 'destructive',
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['memberships', familyId] }),
  });

  // Reject membership mutation
  const rejectMemberMutation = useMutation({
    mutationFn: (m) => base44.functions.invoke('family', { action: 'rejectMember',
      membership_id: m.id,
      family_id: m.family_id,
    }),
    onMutate: async (m) => {
      await queryClient.cancelQueries({ queryKey: ['memberships', familyId] });
      const previous = queryClient.getQueryData(['memberships', familyId]);
      // Optimistic: update membership to rejected
      queryClient.setQueryData(['memberships', familyId], (old = []) =>
        old.map(mem => mem.id === m.id ? { ...mem, status: 'rejected' } : mem)
      );
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['memberships', familyId], ctx.previous);
      toast({
        title: 'Error al rechazar',
        description: err?.response?.data?.error || err?.message || 'No se pudo rechazar la solicitud.',
        variant: 'destructive',
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['memberships', familyId] }),
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (m) => base44.functions.invoke('family', { action: 'removeMember',
      membership_id: m.id,
      target_user_id: m.user_id,
    }),
    onMutate: async (m) => {
      await queryClient.cancelQueries({ queryKey: ['memberships', familyId] });
      const previous = queryClient.getQueryData(['memberships', familyId]);
      // Optimistic: remove membership
      queryClient.setQueryData(['memberships', familyId], (old = []) =>
        old.filter(mem => mem.id !== m.id)
      );
      return { previous };
    },
    onError: (err, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['memberships', familyId], ctx.previous);
      toast({
        title: 'Error al eliminar miembro',
        description: err?.message || 'No se pudo eliminar el miembro.',
        variant: 'destructive',
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['memberships', familyId] }),
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: (email) => base44.users.inviteUser(email.trim().toLowerCase(), 'user'),
    onSuccess: () => {
      setShowInviteSuccess(true);
      setInviteEmail('');
      setTimeout(() => setShowInviteSuccess(false), 3000);
    },
    onError: (err) => {
      toast({
        title: 'Error al invitar',
        description: err?.message || 'No se pudo enviar la invitación.',
        variant: 'destructive',
      });
    },
  });

  // Rol que tomará cada solicitante al aprobarlo (por defecto, miembro).
  const [chosenRoles, setChosenRoles] = useState({});
  const handleApprove = (m) => approveMemberMutation.mutate({ m, role: chosenRoles[m.id] || 'member' });
  const handleReject = (m) => rejectMemberMutation.mutate(m);
  const handleRemoveMember = async (m) => {
    if (await confirmDelete(`¿Eliminar a ${m.user_name || m.user_email} de la familia?`)) {
      removeMemberMutation.mutate(m);
    }
  };
  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    inviteUserMutation.mutate(inviteEmail);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(family?.join_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAdmin) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-muted-foreground text-sm">Solo el administrador puede ver esta sección.</p>
    </div>
  );

  return (
    <div className="pb-6">
      <ConfirmDialog />
      {/* Modal de invitación enviada */}
      {showInviteSuccess && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-income/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-income" />
                </div>
                <h3 className="font-semibold text-foreground">Invitación enviada ✓</h3>
              </div>
              <button
                onClick={() => setShowInviteSuccess(false)}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">El usuario recibirá un correo para acceder a la app.</p>
          </div>
        </div>
      )}

      <PageHeader title="Admin Familia" subtitle={family?.name} />

      {/* Billing status card */}
      {billingStatus && billingStatus !== 'active' && (
        <div className={`mx-4 mt-4 p-3 rounded-2xl border flex items-center gap-3 ${
          isReadOnly
            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
            : 'bg-primary/5 border-primary/20'
        }`}>
          {isReadOnly
            ? <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            : <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold ${ isReadOnly ? 'text-amber-700 dark:text-amber-400' : 'text-primary' }`}>
              {isReadOnly ? 'Modo solo lectura — Prueba terminada' : billingStatus === 'trial' ? `Prueba gratuita · ${trialDaysLeft ?? '?'} días restantes` : 'Plan activo'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isReadOnly
                ? 'Activa una licencia para aprobar nuevos miembros y editar datos.'
                : `Hasta ${licensedMemberLimit} integrantes · Plan ${family?.license_plan || 'home'}`}
            </p>
          </div>
          {(isReadOnly || (billingStatus === 'trial' && (trialDaysLeft ?? 30) <= 14)) && (
            <button onClick={() => setShowUpgrade(true)}
              className="flex-shrink-0 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-xl text-[11px] font-bold">
              Ver planes
            </button>
          )}
        </div>
      )}

      {/* Miembros actuales vs límite */}
      {licensedMemberLimit && (
        <div className="mx-4 mt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{approved.length} / {licensedMemberLimit} integrantes en tu plan</span>
            {approved.length >= licensedMemberLimit && (
              <span className="text-amber-600 font-semibold ml-1">· Límite alcanzado</span>
            )}
          </div>
          {Number.isFinite(licensedMemberLimit) && licensedMemberLimit <= 30 && (
            // mario_style life bar: one block per seat; sits on the page background, so --play-track stays default.
            <div className="play-hp mt-1.5" data-tone={quotaTone(approved.length, licensedMemberLimit)}
              style={/** @type {React.CSSProperties} */ ({ '--play-hp-total': licensedMemberLimit })}
              role="img" aria-label={`${approved.length} de ${licensedMemberLimit} integrantes`}>
              {Array.from({ length: licensedMemberLimit }, (_, i) => (
                <span key={i} data-on={i < approved.length ? '' : undefined} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Código de invitación */}
      <div data-tutorial="family-admin-code-card" className="mx-4 mt-4 p-4 bg-primary/10 border border-primary/30 rounded-2xl">
        <p className="text-xs text-muted-foreground mb-1">Código de invitación</p>
        <div className="flex items-center justify-between">
          <span className="font-mono font-black text-2xl text-primary tracking-widest">{family?.join_code}</span>
          <button onClick={copyCode} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-medium">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Comparte este código con los miembros de tu familia para que puedan solicitar acceso.</p>
      </div>

      {/* Invitar miembro */}
      <div className="mx-4 mt-4">
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-muted-foreground" />
          Invitar miembro
        </h3>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <p className="text-xs text-muted-foreground">El invitado recibirá un correo para acceder a la app. Luego deberá unirse con el código de familia.</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button onClick={handleInvite} disabled={inviteUserMutation.isPending || !inviteEmail.trim() || isReadOnly || approved.length >= licensedMemberLimit}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-50">
              {inviteUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Invitar
            </button>
            </div>
            </div>
            </div>

      {/* Solicitudes pendientes */}
      <div data-tutorial="family-admin-pending-card" className="mx-4 mt-4">
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {pending.length}
          </span>
          Solicitudes pendientes
        </h3>

        {pending.length > 0 ? (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {pending.map((m, i) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < pending.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {m.user_name || 'Sin nombre'}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.user_email}</p>
                </div>

                <select
                  aria-label={`Rol de ${m.user_name || m.user_email}`}
                  value={chosenRoles[m.id] || 'member'}
                  onChange={e => setChosenRoles(r => ({ ...r, [m.id]: e.target.value }))}
                  className="text-xs bg-muted rounded-lg px-2 py-1.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 border border-border"
                >
                  <option value="member">Miembro</option>
                  <option value="admin">Administrador</option>
                </select>

                <button
                  onClick={() =>
                    !isReadOnly && approved.length < licensedMemberLimit && handleApprove(m)
                  }
                  disabled={isReadOnly || approved.length >= licensedMemberLimit}
                  className="p-2 rounded-xl bg-income/10 text-income hover:bg-income/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-5 h-5" />
                </button>

                <button
                  onClick={() => handleReject(m)}
                  className="p-2 rounded-xl bg-expense/10 text-expense hover:bg-expense/20 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-sm font-medium text-foreground">
              Aquí aparecerán las solicitudes pendientes
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cuando alguien capture el código de familia y solicite acceso, podrás aprobarlo o rechazarlo aquí.
            </p>
          </div>
        )}
      </div>

      {/* Miembros aprobados */}
      <div className="mx-4 mt-4">
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          Miembros ({approved.length})
        </h3>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {approved.map((m, i) => {
            const linkedPerson = m.person_id
              ? persons.find(p => String(p.id) === String(m.person_id))
              : null;
            return (
              <div key={m.id} className={`px-4 py-3 ${i < approved.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {(m.user_name || m.user_email)?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.user_name || m.user_email}</p>
                    <p className="text-xs text-muted-foreground">{m.role === 'admin' ? '👑 Administrador' : 'Miembro'}</p>
                  </div>
                  {m.role !== 'admin' && (
                    <button onClick={() => handleRemoveMember(m)} className="p-2 rounded-xl bg-expense/10 text-expense hover:bg-expense/20 transition-colors flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {persons.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    {linkedPerson ? (
                      <>
                        <span className="flex-1 text-xs font-medium text-foreground">{linkedPerson.name}</span>
                        <button
                          onClick={() => linkPersonMutation.mutate({ membershipId: m.id, personId: '' })}
                          className="text-[10px] text-muted-foreground hover:text-expense transition-colors whitespace-nowrap"
                        >
                          Desvincular
                        </button>
                      </>
                    ) : (
                      <select
                        value=""
                        onChange={e => e.target.value && linkPersonMutation.mutate({ membershipId: m.id, personId: e.target.value })}
                        className="flex-1 text-xs bg-muted rounded-lg px-2 py-1.5 text-foreground outline-none focus:ring-2 focus:ring-primary/30 border border-border"
                      >
                        <option value="">Sin vincular</option>
                        {persons.map(p => (
                          <option key={p.id} value={String(p.id)}>{p.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Platform admin: backfill permissions */}
      {isPlatformAdmin && (
        <div className="mx-4 mt-6 p-4 bg-muted/50 border border-border rounded-2xl">
          <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
            <DatabaseZap className="w-3.5 h-3.5 text-primary" />
            Backfill de permisos (solo platform admin)
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Agrega module.Trips y module.Goals a todas las familias que aún no los tengan.
          </p>
          <button
            onClick={handleBackfill}
            disabled={backfilling}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-50"
          >
            {backfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseZap className="w-4 h-4" />}
            {backfilling ? 'Procesando...' : 'Ejecutar backfill'}
          </button>
        </div>
      )}

      <UpgradePlansModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}