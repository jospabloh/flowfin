import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import NativeSelect from '@/components/NativeSelect';
import PageHeader from '@/components/PageHeader';
import { Plus, MessageCircle, CreditCard, TrendingUp, ArrowRightLeft } from 'lucide-react';

const CATEGORIES = [
  { value: 'general', label: '💬 General' },
  { value: 'payment', label: '💳 Pago' },
  { value: 'income', label: '💰 Ingreso' },
  { value: 'movement', label: '↔️ Movimiento' },
];

const CATEGORY_ICONS = {
  general: MessageCircle,
  payment: CreditCard,
  income: TrendingUp,
  movement: ArrowRightLeft,
};

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Messages() {
  const { familyId, currentUser } = useFamily();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showComposer, setShowComposer] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [category, setCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { data: memberships = [] } = useQuery({
    queryKey: ['family-memberships-messages', familyId],
    queryFn: () => base44.entities.FamilyMembership.filter({ family_id: familyId, status: 'approved' }),
    enabled: !!familyId,
  });

  const { data: received = [] } = useQuery({
    queryKey: ['messages-received', familyId, currentUser?.id],
    queryFn: () => base44.entities.Message.filter({ family_id: familyId, recipient_user_id: currentUser.id }),
    enabled: !!familyId && !!currentUser?.id,
    select: (data) => [...data].sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1)),
  });

  const { data: sent = [] } = useQuery({
    queryKey: ['messages-sent', familyId, currentUser?.id],
    queryFn: () => base44.entities.Message.filter({ family_id: familyId, sender_user_id: currentUser.id }),
    enabled: !!familyId && !!currentUser?.id,
    select: (data) => [...data].sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1)),
  });

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages-sent', familyId, currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages-popup', familyId] });
      toast({ title: 'Mensaje enviado', duration: 3000 });
      resetComposer();
    },
  });

  const otherMembers = memberships.filter((m) => m.user_id !== currentUser?.id);

  const recipientOptions = otherMembers.map((m) => ({
    value: m.user_id,
    label: m.user_name || m.user_email,
  }));

  function resetComposer() {
    setShowComposer(false);
    setRecipientId('');
    setCategory('general');
    setSubject('');
    setBody('');
  }

  async function handleSend() {
    if (!body.trim() || !recipientId || isSending) return;
    const recipient = memberships.find((m) => m.user_id === recipientId);
    if (!recipient) return;
    setIsSending(true);
    try {
      await sendMutation.mutateAsync({
        family_id: familyId,
        sender_user_id: currentUser.id,
        sender_user_email: currentUser.email,
        sender_user_name: currentUser.full_name || currentUser.email,
        recipient_user_id: recipient.user_id,
        recipient_user_email: recipient.user_email,
        recipient_user_name: recipient.user_name || recipient.user_email,
        subject: subject.trim() || undefined,
        body: body.trim(),
        category,
        sent_at: new Date().toISOString(),
        status: 'sent',
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Mensajes"
        subtitle="Comunicación con tu familia"
        action={
          <button
            onClick={() => setShowComposer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo mensaje
          </button>
        }
      />

      <div className="px-4">
        <Tabs defaultValue="recibidos">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="recibidos" className="flex-1">
              Recibidos
              {received.filter((m) => m.status === 'sent').length > 0 && (
                <span className="ml-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                  {received.filter((m) => m.status === 'sent').length > 9
                    ? '9+'
                    : received.filter((m) => m.status === 'sent').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="enviados" className="flex-1">
              Enviados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recibidos">
            {received.length === 0 ? (
              <div className="text-center py-12 bg-card border border-border rounded-2xl">
                <p className="text-3xl mb-2">📬</p>
                <p className="text-sm font-semibold text-foreground">Sin mensajes recibidos</p>
                <p className="text-xs text-muted-foreground mt-1">Los mensajes de tu familia aparecerán aquí.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {received.map((msg) => {
                  const CategoryIcon = CATEGORY_ICONS[msg.category] || MessageCircle;
                  const unread = msg.status === 'sent';
                  return (
                    <Card key={msg.id} className={unread ? 'border-primary/30 bg-primary/5' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <CategoryIcon className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 justify-between mb-0.5">
                              <p className="text-xs font-semibold text-foreground">
                                {msg.sender_user_name || msg.sender_user_email}
                              </p>
                              <div className="flex items-center gap-1.5">
                                {unread && (
                                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                )}
                                <p className="text-[10px] text-muted-foreground">{formatDate(msg.sent_at)}</p>
                              </div>
                            </div>
                            {msg.subject && (
                              <p className="text-xs font-medium text-foreground mb-0.5">{msg.subject}</p>
                            )}
                            <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{msg.body}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="enviados">
            {sent.length === 0 ? (
              <div className="text-center py-12 bg-card border border-border rounded-2xl">
                <p className="text-3xl mb-2">📤</p>
                <p className="text-sm font-semibold text-foreground">Sin mensajes enviados</p>
                <p className="text-xs text-muted-foreground mt-1">Los mensajes que envíes aparecerán aquí.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sent.map((msg) => {
                  const CategoryIcon = CATEGORY_ICONS[msg.category] || MessageCircle;
                  return (
                    <Card key={msg.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <CategoryIcon className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 justify-between mb-0.5">
                              <p className="text-xs font-semibold text-foreground">
                                Para: {msg.recipient_user_name || msg.recipient_user_email}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{formatDate(msg.sent_at)}</p>
                            </div>
                            {msg.subject && (
                              <p className="text-xs font-medium text-foreground mb-0.5">{msg.subject}</p>
                            )}
                            <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{msg.body}</p>
                            <p className="text-[10px] mt-1.5">
                              {msg.status === 'read' ? (
                                <span className="text-emerald-600 font-medium">
                                  Leído ✓ — {formatDate(msg.read_at)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Sin leer</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showComposer} onOpenChange={(open) => { if (!open) resetComposer(); }}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>Nuevo mensaje</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Destinatario *</p>
              <NativeSelect
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                placeholder="Seleccionar miembro"
                options={recipientOptions}
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Categoría</p>
              <NativeSelect
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Categoría"
                options={CATEGORIES}
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Asunto</p>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Asunto (opcional)"
                maxLength={80}
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Mensaje *</p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escribe tu mensaje..."
                maxLength={500}
                rows={4}
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
              <p className="text-[10px] text-muted-foreground text-right mt-0.5">{body.length}/500</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={resetComposer}
              className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={!body.trim() || !recipientId || isSending}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm shadow-sm disabled:opacity-50 active:opacity-80 transition-opacity min-h-[44px]"
            >
              {isSending ? 'Enviando...' : 'Enviar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
