import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { ChevronLeft, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import FiniaMessageBubble from '@/components/finia/FiniaMessageBubble';
import FiniaWelcome from '@/components/finia/FiniaWelcome';
import FiniaTypingIndicator from '@/components/finia/FiniaTypingIndicator';
import FiniaComposer from '@/components/finia/FiniaComposer';

const AGENT_NAME = 'finia';
const STORAGE_KEY_PREFIX = 'ff_finia_conv:';

export default function Assistant() {
  const { currentUser, familyId } = useFamily();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [initError, setInitError] = useState(false);
  const serverIdsRef = useRef(new Set());
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const userScrolledRef = useRef(false);

  // ── Init conversation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id || !familyId) return;
    const storageKey = `${STORAGE_KEY_PREFIX}${familyId}:${currentUser.id}`;
    const todayISO = new Date().toISOString().slice(0, 10);
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { /* ignore */ }

    if (stored?.date === todayISO && stored?.conversationId) {
      setConversation({ id: stored.conversationId });
      return;
    }

    base44.agents.createConversation({
      agent_name: AGENT_NAME,
      metadata: { name: `Finia ${todayISO}`, family_id: familyId },
    }).then(c => {
      setConversation(c);
      try { localStorage.setItem(storageKey, JSON.stringify({ conversationId: c.id, date: todayISO })); } catch { /* ignore */ }
    }).catch(() => setInitError(true));
  }, [currentUser?.id, familyId]);

  // ── Subscribe to conversation ──────────────────────────────────────────────
  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const serverMsgs = (data.messages || []).filter(m => m.content?.trim());
      setMessages(prev => {
        let updated = [...prev];
        let changed = false;
        for (const m of serverMsgs) {
          const id = m.id || m._id;
          if (!id) continue;
          if (serverIdsRef.current.has(id)) {
            if (m.role === 'assistant') {
              const idx = updated.findIndex(x => x.id === id);
              if (idx !== -1 && updated[idx].content !== m.content) {
                updated = [...updated];
                updated[idx] = { ...updated[idx], content: m.content };
                changed = true;
              }
            }
            continue;
          }
          serverIdsRef.current.add(id);
          updated = updated.filter(x => !(x.source === 'local' && x.role === m.role && x.content === m.content));
          updated = [...updated, { id, role: m.role, content: m.content, source: 'server' }];
          changed = true;
        }
        return changed ? updated : prev;
      });
    });
    return unsub;
  }, [conversation?.id]);

  // ── Auto-scroll — only if user hasn't manually scrolled up ────────────────
  useEffect(() => {
    if (userScrolledRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Track manual scroll
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      userScrolledRef.current = distFromBottom > 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const msg = typeof text === 'string' ? text.trim() : '';
    if (!msg || sending || !conversation) return;
    userScrolledRef.current = false;
    setSending(true);

    const localId = `local-user-${Date.now()}`;
    setMessages(prev => [...prev, { id: localId, role: 'user', content: msg, source: 'local' }]);

    await base44.agents.addMessage(conversation, { role: 'user', content: msg });
    setSending(false);
  }, [sending, conversation]);

  // ── Loading state ────────────────────────────────────────────────────────────
  if (!conversation && !initError) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-3xl bg-primary/10 flex items-center justify-center text-2xl animate-pulse">
          💚
        </div>
        <p className="text-sm text-muted-foreground">Iniciando Finia…</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 px-8 text-center">
        <div className="text-3xl">😕</div>
        <p className="text-sm font-semibold text-foreground">No se pudo iniciar Finia</p>
        <p className="text-xs text-muted-foreground">Verifica tu conexión e intenta de nuevo.</p>
        <button
          onClick={() => { setInitError(false); window.location.reload(); }}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div
      className="flex flex-col bg-background"
      style={{ height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}
    >
      {/* ── Sticky Header ────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center gap-3 px-3 pt-safe pt-3 pb-3 bg-background/95 backdrop-blur-sm border-b border-border z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95 flex-shrink-0"
          aria-label="Regresar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center text-lg flex-shrink-0 ring-1 ring-primary/10 shadow-sm">
          💚
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-foreground leading-tight">Finia</h1>
            <span className="w-1.5 h-1.5 rounded-full bg-income flex-shrink-0" />
          </div>
          <p className="text-[11px] text-muted-foreground truncate">Tu copiloto financiero familiar</p>
        </div>

        {/* WhatsApp badge */}
        <a
          href={base44.agents.getWhatsAppConnectURL(AGENT_NAME)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#25D366]/10 text-[#25D366] text-[11px] font-semibold hover:bg-[#25D366]/20 transition-colors flex-shrink-0 border border-[#25D366]/20"
          title="Hablar con Finia por WhatsApp"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">WhatsApp</span>
        </a>
      </header>

      {/* ── Messages area ────────────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="px-4 py-4 space-y-3 min-h-full flex flex-col justify-end">
          {/* Empty state */}
          {!hasMessages && (
            <div className="flex-1">
              <FiniaWelcome onAction={sendMessage} />
            </div>
          )}

          {/* Messages */}
          {hasMessages && (
            <div className="space-y-3 pt-2">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                  >
                    <FiniaMessageBubble message={msg} />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              {sending && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <FiniaTypingIndicator />
                </motion.div>
              )}
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {/* ── Bottom composer ───────────────────────────────────────────────── */}
      <FiniaComposer
        onSend={sendMessage}
        disabled={sending || !conversation}
        showChips={hasMessages}
      />
    </div>
  );
}