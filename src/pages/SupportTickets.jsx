import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { useToast } from '@/components/ui/use-toast';
import { usePermission } from '@/lib/permissions/usePermission';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, ArrowLeft, LifeBuoy, Send } from 'lucide-react';

const STATUS_LABEL = {
  open: 'Abierto', in_progress: 'En proceso', waiting_customer: 'Esperando tu respuesta',
  resolved: 'Resuelto', closed: 'Cerrado',
};
const STATUS_STYLE = {
  open: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700',
  waiting_customer: 'bg-amber-100 text-amber-700', resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-muted text-muted-foreground',
};
const CATEGORIES = [
  { v: 'technical', l: 'Técnico' }, { v: 'billing', l: 'Facturación' }, { v: 'account', l: 'Cuenta' },
  { v: 'feature_request', l: 'Sugerencia' }, { v: 'other', l: 'Otro' },
];
const PRIORITIES = [{ v: 'low', l: 'Baja' }, { v: 'normal', l: 'Normal' }, { v: 'high', l: 'Alta' }, { v: 'urgent', l: 'Urgente' }];

function fmt(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function SupportTickets() {
  const { familyId, currentUser } = useFamily();
  const { toast } = useToast();
  const { can_view: canView }  = usePermission('module.SupportTickets');
  const { can_write: canWrite } = usePermission('support.ticket.create');
  const [tickets, setTickets] = useState(null);
  const [view, setView] = useState('list');
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState(null);
  const [form, setForm] = useState({ subject: '', description: '', category: 'technical', priority: 'normal' });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!familyId) return;
    try {
      const rows = await base44.entities.SupportTicket.filter({ family_id: familyId }, '-last_message_at', 200);
      setTickets(rows ?? []);
    } catch (e) { toast({ title: 'Soporte', description: e.message, variant: 'destructive' }); setTickets([]); }
  }, [familyId, toast]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
        <LifeBuoy className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">No tienes acceso al módulo de soporte.</p>
      </div>
    );
  }

  async function openThread(t) {
    setActive(t); setView('thread'); setMessages(null); setReply('');
    try {
      const rows = await base44.entities.SupportTicketMessage.filter({ ticket_id: t.id }, 'created_date', 200);
      setMessages(rows ?? []);
      if (t.unread_for_tenant) base44.entities.SupportTicket.update(t.id, { unread_for_tenant: false }).catch(() => {});
    } catch (e) { toast({ title: 'Soporte', description: e.message, variant: 'destructive' }); setMessages([]); }
  }

  async function createTicket() {
    if (!form.subject.trim() || !form.description.trim()) { toast({ title: 'Faltan datos', description: 'Asunto y descripción son obligatorios.', variant: 'destructive' }); return; }
    setBusy(true);
    const now = new Date().toISOString();
    try {
      const ticket = await base44.entities.SupportTicket.create({
        family_id: familyId, subject: form.subject.trim(), description: form.description.trim(),
        category: form.category, priority: form.priority, status: 'open',
        created_by_id: currentUser?.id, created_by_email: currentUser?.email,
        unread_for_owner: true, unread_for_tenant: false,
        last_message_at: now, last_message_by_role: 'tenant', messages_count: 1,
      });
      await base44.entities.SupportTicketMessage.create({
        ticket_id: ticket.id, family_id: familyId,
        author_id: currentUser?.id, author_email: currentUser?.email, author_name: currentUser?.full_name || currentUser?.email,
        author_role: 'tenant', body: form.description.trim(), is_internal_note: false,
      });
      toast({ title: 'Ticket enviado', description: 'Te responderemos pronto.', duration: 3000 });
      setForm({ subject: '', description: '', category: 'technical', priority: 'normal' });
      setView('list'); await loadTickets();
    } catch (e) { toast({ title: 'Soporte', description: e.message, variant: 'destructive' }); } finally { setBusy(false); }
  }

  async function sendReply() {
    if (!reply.trim() || !active) return;
    setBusy(true);
    const now = new Date().toISOString();
    try {
      await base44.entities.SupportTicketMessage.create({
        ticket_id: active.id, family_id: familyId,
        author_id: currentUser?.id, author_email: currentUser?.email, author_name: currentUser?.full_name || currentUser?.email,
        author_role: 'tenant', body: reply.trim(), is_internal_note: false,
      });
      await base44.entities.SupportTicket.update(active.id, {
        last_message_at: now, last_message_by_role: 'tenant', unread_for_owner: true,
        messages_count: (active.messages_count || (messages?.length ?? 0)) + 1,
        status: active.status === 'resolved' || active.status === 'closed' ? 'open' : active.status,
      });
      setReply('');
      await openThread({ ...active, messages_count: (active.messages_count || 0) + 1 });
      await loadTickets();
    } catch (e) { toast({ title: 'Soporte', description: e.message, variant: 'destructive' }); } finally { setBusy(false); }
  }

  const Badge = ({ s }) => (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s] || 'bg-muted text-muted-foreground'}`}>{STATUS_LABEL[s] || s}</span>
  );

  if (view === 'new') {
    return (
      <div>
        <PageHeader title="Nuevo ticket" subtitle="Cuéntanos qué necesitas y te ayudamos." />
        <div className="max-w-2xl mx-auto px-4 space-y-4">
          <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver</button>
          <Card className="p-5 space-y-4">
            <div><label className="text-sm font-medium">Asunto</label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Resumen del problema" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Categoría</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium">Prioridad</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                </select>
              </div>
            </div>
            <div><label className="text-sm font-medium">Descripción</label><Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Cuéntanos qué ocurre…" /></div>
            <div className="flex justify-end"><Button onClick={createTicket} disabled={busy}>{busy ? 'Enviando…' : 'Enviar ticket'}</Button></div>
          </Card>
        </div>
      </div>
    );
  }

  if (view === 'thread' && active) {
    return (
      <div>
        <PageHeader title={active.subject} action={<Badge s={active.status} />} />
        <div className="max-w-2xl mx-auto px-4 space-y-4">
          <button onClick={() => { setView('list'); loadTickets(); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver</button>
          <Card className="p-4 space-y-3 max-h-[55vh] overflow-y-auto">
            {messages === null ? <p className="text-sm text-muted-foreground">Cargando…</p>
              : messages.length === 0 ? <p className="text-sm text-muted-foreground">Sin mensajes.</p>
              : messages.map((m) => (
                <div key={m.id} className={`rounded-lg px-3 py-2 text-sm ${m.author_role === 'owner' ? 'bg-blue-50 border border-blue-100' : 'bg-muted'}`}>
                  <div className="mb-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-medium">{m.author_role === 'owner' ? 'Soporte ACACIA' : (m.author_name || 'Tú')}</span>
                    <span>{fmt(m.created_date)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
          </Card>
          {active.status !== 'closed' && (
            <Card className="p-3">
              <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escribe tu respuesta…" />
              <div className="mt-2 flex justify-end"><Button onClick={sendReply} disabled={busy || !reply.trim()}><Send className="mr-1 h-4 w-4" />{busy ? 'Enviando…' : 'Responder'}</Button></div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Soporte" subtitle="Abre un ticket y te respondemos desde aquí."
        action={canWrite && <Button onClick={() => setView('new')}><Plus className="mr-1 h-4 w-4" /> Nuevo ticket</Button>} />
      <div className="max-w-2xl mx-auto px-4 space-y-3">
        {tickets === null ? <p className="text-sm text-muted-foreground">Cargando…</p>
          : tickets.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              <LifeBuoy className="mx-auto mb-2 h-6 w-6 opacity-60" />
              Aún no tienes tickets. Abre uno y nuestro equipo te responderá desde aquí.
            </Card>
          ) : tickets.map((t) => (
            <Card key={t.id} className="p-4 cursor-pointer hover:bg-muted/40" onClick={() => openThread(t)}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{t.subject}</span>
                <Badge s={t.status} />
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{fmt(t.last_message_at || t.created_date)}</span>
                {t.unread_for_tenant && <span className="rounded-full bg-blue-500 px-1.5 text-[10px] text-white">nuevo</span>}
              </div>
            </Card>
          ))}
      </div>
    </div>
  );
}
