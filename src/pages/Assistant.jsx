import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { Send, Mic, MicOff, History, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FiniaMessageBubble from '@/components/finia/FiniaMessageBubble';
import FiniaWelcome from '@/components/finia/FiniaWelcome';

const AGENT_NAME = 'finia';
const STORAGE_KEY_PREFIX = 'ff_finia_conv:';

export default function Assistant() {
  const { currentUser, familyId } = useFamily();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const serverIdsRef = useRef(new Set());
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // ── Init: create or resume today's conversation ──────────────────────────
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
    });
  }, [currentUser?.id, familyId]);

  // ── Subscribe to conversation updates ───────────────────────────────────
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

  // ── Scroll to bottom ────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // ── Send message ────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const msg = (typeof text === 'string' ? text : input).trim();
    if (!msg || sending || !conversation) return;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = '48px';
    setSending(true);

    const now = Date.now();
    const localId = `local-user-${now}`;
    setMessages(prev => [...prev, { id: localId, role: 'user', content: msg, source: 'local' }]);

    await base44.agents.addMessage(conversation, { role: 'user', content: msg });
    setSending(false);
  }, [input, sending, conversation]);

  // ── Voice ────────────────────────────────────────────────────────────────
  const startVoice = () => {
    const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz'); return; }
    const r = new SR();
    r.lang = 'es-MX';
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    r.onresult = (e) => sendMessage(e.results[0][0].transcript);
    r.start();
    recognitionRef.current = r;
  };
  const stopVoice = () => { recognitionRef.current?.stop(); setIsListening(false); };

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="text-2xl">💚</div>
          <p className="text-sm text-muted-foreground">Iniciando Finia...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-xl shadow-sm">
          💚
        </div>
        <div className="flex-1">
          <h1 className="font-bold text-foreground text-sm">Finia</h1>
          <p className="text-xs text-muted-foreground">Copiloto financiero familiar</p>
        </div>
        <a
          href={base44.agents.getWhatsAppConnectURL(AGENT_NAME)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] text-white text-xs font-semibold hover:bg-[#1ebe5d] transition-colors flex-shrink-0"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <FiniaWelcome onAction={sendMessage} />
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <FiniaMessageBubble message={msg} />
            </motion.div>
          ))}
        </AnimatePresence>

        {sending && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
              💚
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-muted-foreground/50"
                    animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 px-4 pt-2 pb-4 border-t border-border bg-background">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Escríbele a Finia..."
            className="flex-1 bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none leading-relaxed"
            style={{ minHeight: '48px', maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            onClick={isListening ? stopVoice : startVoice}
            className={`flex-shrink-0 p-3 rounded-xl transition-all ${
              isListening
                ? 'bg-destructive text-white animate-pulse'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-all hover:bg-primary/90"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
          Finia opera con datos reales de tu familia. Siempre confirma antes de guardar.
        </p>
      </div>
    </div>
  );
}