import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useFamily } from '@/lib/FamilyContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { MessageCircle, CreditCard, TrendingUp, ArrowRightLeft } from 'lucide-react';

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

export default function MessagePopup() {
  const { user } = useAuth();
  const { familyId } = useFamily();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: messages = [] } = useQuery({
    queryKey: ['unread-messages-popup', familyId, user?.id],
    queryFn: () => base44.entities.Message.filter({
      family_id: familyId,
      recipient_user_id: user.id,
      status: 'sent',
    }),
    enabled: !!familyId && !!user?.id && !isOpen,
    refetchInterval: 90_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
    select: (data) => [...data].sort((a, b) => (a.sent_at > b.sent_at ? 1 : -1)),
  });

  useEffect(() => {
    if (messages.length > 0 && !isOpen) {
      setCurrentIndex(0);
      setIsOpen(true);
    }
  }, [messages.length]);

  const markReadMutation = useMutation({
    mutationFn: (id) =>
      base44.entities.Message.update(id, {
        read_at: new Date().toISOString(),
        status: 'read',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-messages-popup', familyId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['messages-received', familyId, user?.id] });
      const next = currentIndex + 1;
      if (next < messages.length) {
        setCurrentIndex(next);
      } else {
        setIsOpen(false);
      }
    },
  });

  if (!user || !familyId || messages.length === 0) return null;

  const message = messages[currentIndex];
  if (!message) return null;

  const CategoryIcon = CATEGORY_ICONS[message.category] || MessageCircle;
  const senderLabel = message.sender_user_name || message.sender_user_email;

  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="max-w-sm mx-4"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <CategoryIcon className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Mensaje de</p>
              <DialogTitle className="text-sm font-semibold leading-tight">{senderLabel}</DialogTitle>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{formatDate(message.sent_at)}</p>
        </DialogHeader>

        <div className="space-y-2">
          {message.subject && (
            <p className="text-sm font-semibold text-foreground">{message.subject}</p>
          )}
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{message.body}</p>
        </div>

        {messages.length > 1 && (
          <p className="text-xs text-muted-foreground text-center">
            {currentIndex + 1} de {messages.length}
          </p>
        )}

        <DialogFooter>
          <button
            onClick={() => markReadMutation.mutate(message.id)}
            disabled={markReadMutation.isPending}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm shadow-sm disabled:opacity-50 active:opacity-80 transition-opacity min-h-[44px]"
          >
            OK
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
