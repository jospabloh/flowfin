import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { ChevronLeft, MessageCircle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import FiniaMessageBubble from '@/components/finia/FiniaMessageBubble';
import FiniaWelcome from '@/components/finia/FiniaWelcome';
import FiniaTypingIndicator from '@/components/finia/FiniaTypingIndicator';
import FiniaComposer from '@/components/finia/FiniaComposer';

// Hook: tracks visible viewport height and offset to handle virtual keyboard on Android/iOS.
// When the keyboard opens, visualViewport.height shrinks and offsetTop may change.
// We use this to set the exact container height, making the composer float just above the keyboard.
function useVisualViewport() {
  const [vp, setVp] = useState(() => ({
    height: window.visualViewport?.height ?? window.innerHeight,
    offsetTop: window.visualViewport?.offsetTop ?? 0,
  }));
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVp({ height: vv.height, offsetTop: vv.offsetTop });
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);
  return vp;
}

const AGENT_NAME = 'finia';
const STORAGE_KEY_PREFIX = 'ff_finia_conv:';
const USER_TZ = 'America/Mexico_City';
const MAX_HISTORY_DAYS = 3;

// Returns today's date string in USER_TZ (YYYY-MM-DD)
function todayInTZ() {
  return new Date().toLocaleDateString('en-CA', { timeZone: USER_TZ });
}

// Returns how many calendar days ago a date string was (in USER_TZ)
function daysAgo(dateStr) {
  const today = todayInTZ();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((new Date(today) - new Date(dateStr)) / msPerDay);
}

export default function Assistant() {
  const { currentUser, familyId } = useFamily();
  const navigate = useNavigate();
  const { height: vvHeight, offsetTop: vvOffsetTop } = useVisualViewport();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [visibleMessages, setVisibleMessages] = useState([]); // cleared by "limpiar" but still exists on server
  const [cleared, setCleared] = useState(false); // tracks if user manually cleared view
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
    const today = todayInTZ();
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { /* ignore */ }

    // If stored date is today (same calendar day in user's TZ), reuse conversation
    if (stored?.date === today && stored?.conversationId) {
      setConversation({ id: stored.conversationId });
      return;
    }

    // If stored date is too old (>MAX_HISTORY_DAYS), start fresh silently
    // Otherwise a new day → new conversation but that's fine
    base44.agents.createConversation({
      agent_name: AGENT_NAME,
      metadata: { name: `Finia ${today}`, family_id: familyId },
    }).then(c => {
      setConversation(c);
      try { localStorage.setItem(storageKey, JSON.stringify({ conversationId: c.id, date: today })); } catch { /* ignore */ }
    }).catch(() => setInitError(true));
  }, [currentUser?.id, familyId]);

  // ── Subscribe to conversation ──────────────────────────────────────────────
  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      // Filter out empty messages and messages that are only tool-call artifacts
      // (single emoji, "?", whitespace, or shorter than 2 visible chars)
      const serverMsgs = (data.messages || []).filter(m => {
        const c = (m.content || '').trim();
        if (!c) return false;
        // Strip emojis/punctuation to check if there's actual text content
        const visible = c.replace(/[\p{Emoji}\p{P}\s]/gu, '');
        if (visible.length < 2) return false;
        return true;
      });

      // Once we receive an assistant message, turn off "sending" state
      const hasAssistantReply = serverMsgs.some(m => m.role === 'assistant');
      if (hasAssistantReply) setSending(false);

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

  // ── Sync visible messages (only when not manually cleared) ────────────────
  useEffect(() => {
    if (!cleared) setVisibleMessages(messages);
  }, [messages, cleared]);

  // When new messages arrive after a clear, show them too
  useEffect(() => {
    if (cleared && messages.length > 0) {
      // Only show messages that arrived AFTER the clear (new ones)
      // We track this by only updating visibleMessages with new additions
      setVisibleMessages(prev => {
        const prevIds = new Set(prev.map(m => m.id));
        const newMsgs = messages.filter(m => !prevIds.has(m.id));
        if (!newMsgs.length) return prev;
        return [...prev, ...newMsgs];
      });
    }
  }, [messages, cleared]);

  // ── Auto-scroll — only if user hasn't manually scrolled up ────────────────
  useEffect(() => {
    if (userScrolledRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages, sending]);

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

  // ── Clear visible window (keeps server history intact) ────────────────────
  const clearWindow = useCallback(() => {
    setCleared(true);
    setVisibleMessages([]);
    userScrolledRef.current = false;
  }, []);

  // ── Send message ────────────────────────────────────────────────────────────
  // Note: `sending` stays true until the assistant's first reply arrives (handled
  // in the subscribe effect). This prevents double-sends from quick chip taps.
  const sendMessage = useCallback(async (text, fileUrls) => {
    const msg = typeof text === 'string' ? text.trim() : '';
    const files = Array.isArray(fileUrls) ? fileUrls.filter(Boolean) : [];
    if ((!msg && !files.length) || sending || !conversation) return;
    userScrolledRef.current = false;
    setSending(true);

    const localId = `local-user-${Date.now()}`;
    const localMsg = { id: localId, role: 'user', content: msg, source: 'local', ...(files.length ? { file_urls: files } : {}) };
    if (cleared) {
      setVisibleMessages(prev => [...prev, localMsg]);
    } else {
      setMessages(prev => [...prev, localMsg]);
    }

    try {
      // Attachments are passed via the agent SDK's dedicated `file_urls` field so the
      // assistant can actually read them — embedding URLs in `content` does not work.
      const payload = { role: 'user', content: msg };
      if (files.length) payload.file_urls = files;
      await base44.agents.addMessage(conversation, payload);
    } catch (err) {
      console.error('Error sending message:', err);
      setSending(false);
    }
    // Safety: re-enable composer after 30s in case no reply arrives
    setTimeout(() => setSending(false), 30000);
  }, [sending, conversation, cleared]);

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

  const hasMessages = visibleMessages.length > 0;

  // Find last assistant message content for contextual chips
  const lastAssistantMessage = (() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (visibleMessages[i].role === 'assistant') return visibleMessages[i].content;
    }
    return null;
  })();

  // The Assistant page is rendered inside a Layout that has a fixed bottom nav on mobile.
  // When the keyboard opens, visualViewport.height shrinks to the visible area above the keyboard.
  // We set the container to exactly that height so the composer always sits just above the keyboard
  // and the bottom nav is covered/pushed out of view automatically.
  // position:fixed + top/left/right/bottom = vvHeight anchors the box to the visual viewport.
  const isMobile = window.innerWidth < 768;
  const containerStyle = isMobile ? {
    position: 'fixed',
    top: `${vvOffsetTop}px`,
    left: 0,
    right: 0,
    height: `${vvHeight}px`,
    zIndex: 45, // above bottom nav (z-40) but below more-drawer (z-50)
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'hsl(var(--background))',
  } : {
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={containerStyle}>
      {/* ── Sticky Header ────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center gap-3 px-3 pt-3 pb-3 bg-background/95 backdrop-blur-sm border-b border-border z-10">
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

        {/* Clear button */}
        {messages.length > 0 && (
          <button
            onClick={clearWindow}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-muted text-muted-foreground text-[11px] font-medium hover:bg-destructive/10 hover:text-destructive transition-colors flex-shrink-0 border border-border"
            title="Limpiar ventana (el historial del día se mantiene)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
        )}

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
                {visibleMessages.map((msg) => (
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
        lastAssistantMessage={lastAssistantMessage}
      />
    </div>
  );
}