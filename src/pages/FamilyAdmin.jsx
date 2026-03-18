import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { CheckCircle, XCircle, Users, Copy, Check, UserPlus, Loader2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useState } from 'react';

export default function FamilyAdmin() {
  const { family, familyId, isAdmin } = useFamily();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  const { data: memberships = [] } = useQuery({
    queryKey: ['memberships', familyId],
    queryFn: () => base44.entities.FamilyMembership.filter({ family_id: familyId }),
    enabled: !!familyId,
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

  const handleApprove = async (m) => {
    await base44.functions.invoke('approveMember', {
      membership_id: m.id,
      family_id: m.family_id,
      target_user_id: m.user_id,
    });
    queryClient.invalidateQueries({ queryKey: ['memberships'] });
  };

  const handleReject = async (m) => {
    await base44.entities.FamilyMembership.update(m.id, { status: 'rejected' });
    queryClient.invalidateQueries({ queryKey: ['memberships'] });
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg('');
    try {
      await base44.users.inviteUser(inviteEmail.trim().toLowerCase(), 'user');
      setInviteMsg('✓ Invitación enviada. El usuario debe abrir el correo para acceder a la app.');
      setInviteEmail('');
    } catch (e) {
      setInviteMsg('Error: ' + (e.message || 'No se pudo invitar'));
    }
    setInviting(false);
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
      <PageHeader title="Admin Familia" subtitle={family?.name} />

      {/* Código de invitación */}
      <div className="mx-4 mt-4 p-4 bg-primary/10 border border-primary/30 rounded-2xl">
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

      {/* Solicitudes pendientes */}
      {pending.length > 0 && (
        <div className="mx-4 mt-4">
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">{pending.length}</span>
            Solicitudes pendientes
          </h3>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {pending.map((m, i) => (
              <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${i < pending.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{m.user_name || 'Sin nombre'}</p>
                  <p className="text-xs text-muted-foreground">{m.user_email}</p>
                </div>
                <button onClick={() => handleApprove(m)} className="p-2 rounded-xl bg-income/10 text-income hover:bg-income/20 transition-colors">
                  <CheckCircle className="w-5 h-5" />
                </button>
                <button onClick={() => handleReject(m)} className="p-2 rounded-xl bg-expense/10 text-expense hover:bg-expense/20 transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Miembros aprobados */}
      <div className="mx-4 mt-4">
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          Miembros ({approved.length})
        </h3>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {approved.map((m, i) => (
            <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${i < approved.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                {(m.user_name || m.user_email)?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{m.user_name || m.user_email}</p>
                <p className="text-xs text-muted-foreground">{m.role === 'admin' ? '👑 Administrador' : 'Miembro'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}