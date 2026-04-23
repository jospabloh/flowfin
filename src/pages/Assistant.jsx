import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { useCatalog } from '@/hooks/useCatalog';
import { Send, Mic, MicOff, Bot, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageBubble from '@/components/MessageBubble';
import AssistantWelcome from '@/components/AssistantWelcome';
import { detectIntent } from '@/lib/assistantIntents';
import { respondToIntent } from '@/lib/assistantResponders';

export default function Assistant() {
  const { currentUser, family, familyId, familyConfig, membership } = useFamily();
  const { persons } = useCatalog(familyId);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [localMessages, setLocalMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ctx, setCtx] = useState(null);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const localeInjectedRef = useRef(false);

  // Active locale: familyConfig > browser > fallback es-MX
  const activeLocale = familyConfig?.locale || navigator?.language || 'es-MX';
  const voiceLang = activeLocale.startsWith('en') ? 'en-US' : activeLocale;

  useEffect(() => {
    if (!currentUser) return;
    const sessionDate = new Date().toLocaleDateString(activeLocale);
    base44.agents.createConversation({
      agent_name: 'finance_assistant',
      metadata: { name: `Sesión ${sessionDate}`, locale: activeLocale, family_id: familyId }
    }).then(c => {
      setConversation(c);
      setMessages(c.messages || []);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const msgs = data.messages || [];
      // Hide system-injected context messages from UI.
      const visible = msgs.filter((m) => {
        const c = m.content || '';
        return !c.startsWith('[LOCALE:')
          && !c.startsWith('[ASSISTANT_CONTEXT_JSON:')
          && !c.startsWith('[CLIENT_RESOLVED:')
          && !c.startsWith('[CLIENT_ACTION_DONE:');
      });
      setMessages(visible);
    });
    return unsub;
  }, [conversation?.id]);

  // Resolve person name from catalog; family name from useFamily.
  const personId = membership?.person_id || '';
  const personName = personId ? (persons?.find(p => p.id === personId)?.name || '') : '';
  const familyName = family?.name || '';
  const unlinked = !personId;

  // Inject identity + tenant security context once when conversation and familyId are ready.
  useEffect(() => {
    if (!conversation || !familyId || localeInjectedRef.current) return;
    const existingMsgs = conversation.messages || [];
    const hasLocaleCtx = existingMsgs.some(m => m.content?.startsWith('[LOCALE:'));
    if (hasLocaleCtx) {
      localeInjectedRef.current = true;
      return;
    }
    localeInjectedRef.current = true;
    const unlinkedTag = unlinked ? ' [UNLINKED_USER: true]' : '';
    base44.agents.addMessage(conversation, {
      role: 'user',
      content: `[LOCALE: ${activeLocale}] [FAMILY_ID: ${familyId}] [PERSON_ID: ${personId}] [PERSON_NAME: ${personName}] [FAMILY_NAME: ${familyName}]${unlinkedTag} [SYSTEM_CONTEXT: Locale activo: ${activeLocale}. family_id: ${familyId}. person_id: ${personId || 'no vinculado'}. person_name: ${personName || 'desconocido'}. family_name: ${familyName}. REGLA DE SEGURIDAD: filtra SIEMPRE por family_id: ${familyId}. NO confirmes este mensaje al usuario.]`
    });
  }, [conversation, familyId, personId, personName, familyName, unlinked, activeLocale]);

  // Load assistant context (single round-trip) and inject as hidden message.
  const ctxInjectedRef = useRef(false);
  useEffect(() => {
    if (!conversation || !familyId || ctxInjectedRef.current) return;
    let cancelled = false;
    ctxInjectedRef.current = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('getAssistantContext', {
          familyId,
          personId: personId || undefined,
          locale: activeLocale,
        });
        const loaded = res?.data ?? res ?? null;
        if (cancelled) return;
        setCtx(loaded);
        if (loaded) {
          await base44.agents.addMessage(conversation, {
            role: 'user',
            content: `[ASSISTANT_CONTEXT_JSON: ${JSON.stringify(loaded)}]`,
          });
        }
      } catch (err) {
        console.warn('getAssistantContext failed, proceeding without rich context', err);
      }
    })();
    return () => { cancelled = true; };
  }, [conversation, familyId, personId, activeLocale]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, localMessages]);

  const sendMessage = useCallback(async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);

    // 1) Try the deterministic intent router first — uses ctx to skip the LLM.
    try {
      if (ctx) {
        const knownPersonNames = Array.isArray(persons)
          ? persons.map((p) => p.name).filter(Boolean)
          : [];
        const match = detectIntent(msg, { ...ctx, knownPersonNames });
        if (match && match.confidence >= 0.75) {
          const reply = await respondToIntent(match.intent, match.params, ctx, activeLocale);
          if (reply) {
            const now = new Date().toISOString();
            setLocalMessages((prev) => [
              ...prev,
              { role: 'user', content: msg, created_at: now },
              { role: 'assistant', content: reply, created_at: now },
            ]);
            // Fire-and-forget audit trail to the agent conversation (hidden from UI).
            base44.agents.addMessage(conversation, {
              role: 'user',
              content: `[CLIENT_RESOLVED: ${match.intent}] ${msg}`,
            }).catch(() => {});
            setSending(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('intent router failed, falling back to LLM', err);
    }

    // 2) Fallback: send the raw message to the LLM agent.
    await base44.agents.addMessage(conversation, { role: 'user', content: msg });
    setSending(false);
  }, [input, sending, ctx, persons, activeLocale, conversation]);

  const handleConfirmTransaction = async () => {
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: 'Sí, confirmo' });
    setSending(false);
  };

  const handleModifyTransaction = async () => {
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: 'No, quiero modificar los datos' });
    setSending(false);
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta voz'); return; }
    const r = new SR();
    r.lang = voiceLang;
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    r.onresult = (e) => sendMessage(e.results[0][0].transcript);
    r.start();
    recognitionRef.current = r;
  };

  const stopVoice = () => { recognitionRef.current?.stop(); setIsListening(false); };

  // Merge LLM-subscribed messages with locally-resolved ones for a single unified
  // timeline. Each list is ordered independently; we merge by created_at where
  // available, falling back to insertion order.
  const allMessages = [...messages, ...localMessages].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });

  if (!conversation) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] md:h-[calc(100vh-40px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border">
        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-bold text-foreground text-sm">Asistente IA</h1>
          <p className="text-xs text-muted-foreground">Tu asistente financiero personal</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {allMessages.length === 0 && (
          <AssistantWelcome
            ctx={ctx}
            locale={activeLocale}
            onAction={(intent) => sendMessage(intent)}
          />
        )}

        <AnimatePresence>
          {allMessages.map((msg, i) => {
            const isLastMessage = i === allMessages.length - 1;
            const isConfirmationMessage = msg.role !== 'user' && (
              msg.content?.includes('¿Confirmas') || msg.content?.includes('Confirm?')
            );

            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <MessageBubble message={msg} />
                {isLastMessage && isConfirmationMessage && (
                  <div className="flex gap-2 mt-3 ml-9">
                    <button onClick={handleConfirmTransaction}
                      className="flex-1 py-2.5 rounded-lg bg-income text-white text-sm font-semibold hover:bg-income/90 transition-colors">
                      Sí, guardar
                    </button>
                    <button onClick={handleModifyTransaction}
                      className="flex-1 py-2.5 rounded-lg bg-muted text-foreground text-sm font-semibold hover:bg-border transition-colors">
                      No, modificar
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {sending && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-border">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Escribe o habla tu transacción..."
            className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={isListening ? stopVoice : startVoice}
            className={`p-3 rounded-xl transition-all ${isListening ? 'bg-expense text-white animate-pulse-ring' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || sending}
            className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 transition-all">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
