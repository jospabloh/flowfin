import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { useCatalog } from '@/hooks/useCatalog';
import { Send, Mic, MicOff, Bot, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageBubble from '@/components/MessageBubble';
import AssistantWelcome from '@/components/AssistantWelcome';
import ReceiptScanButton from '@/components/ReceiptScanButton';
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

  // Active locale: familyConfig > browser > fallback es-MX
  const activeLocale = familyConfig?.locale || navigator?.language || 'es-MX';
  const voiceLang = activeLocale.startsWith('en') ? 'en-US' : activeLocale;

  // Create a fresh conversation on mount — no messages sent here.
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

  // Subscribe to conversation updates.
  // All user messages are displayed via localMessages for immediate feedback,
  // so we drop them from the subscription to avoid duplicates.
  // Empty assistant responses (LLM acknowledging init-only messages) are also hidden.
  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const msgs = data.messages || [];
      const visible = msgs.filter((m) => {
        if (m.role === 'user') return false;
        if (!(m.content || '').trim()) return false;
        return true;
      });
      setMessages(visible);
    });
    return unsub;
  }, [conversation?.id]);

  // Resolve person / family identifiers from context.
  const personId = membership?.person_id || '';
  const personName = personId ? (persons?.find(p => p.id === personId)?.name || '') : '';
  const familyName = family?.name || '';
  const unlinked = !personId;

  // ── Lazy-inject: build identity header in a ref, never send it alone ────────
  // It will be prepended to the FIRST message actually sent to the LLM.
  const identityHeaderRef = useRef('');
  const headerInjectedRef = useRef(false);
  useEffect(() => {
    if (!familyId) return;
    const unlinkedTag = unlinked ? ' [UNLINKED_USER: true]' : '';
    identityHeaderRef.current =
      `[LOCALE: ${activeLocale}] [FAMILY_ID: ${familyId}] [PERSON_ID: ${personId}] ` +
      `[PERSON_NAME: ${personName}] [FAMILY_NAME: ${familyName}]${unlinkedTag} ` +
      `[SYSTEM_CONTEXT: Locale: ${activeLocale}. family_id: ${familyId}. ` +
      `person_id: ${personId || 'no vinculado'}. person_name: ${personName || 'desconocido'}. ` +
      `family_name: ${familyName}. Filtra SIEMPRE por family_id: ${familyId}.]`;
  }, [familyId, personId, personName, familyName, unlinked, activeLocale]);

  // ── Load assistant context (no addMessage) ──────────────────────────────────
  // Stored in a ref for lazy injection. description/person_name stripped from
  // recentTransactions so the LLM cannot treat history as pending actions.
  const ctxPayloadRef = useRef(null);
  const ctxLoadedRef = useRef(false);

  // Reusable context fetcher — called at mount and silently after write intents.
  const refreshContext = useCallback(async () => {
    if (!familyId) return;
    try {
      const res = await base44.functions.invoke('getAssistantContext', {
        familyId,
        personId: personId || undefined,
        locale: activeLocale,
      });
      const loaded = res?.data ?? res ?? null;
      if (!loaded) return;
      setCtx(loaded);
      ctxPayloadRef.current = {
        ...loaded,
        recentTransactions: (loaded.recentTransactions || []).map(
          ({ id, date, amount, type, category_name }) =>
            ({ id, date, amount, type, category_name })
        ),
      };
    } catch (err) {
      console.warn('getAssistantContext failed, proceeding without rich context', err);
    }
  }, [familyId, personId, activeLocale]);

  useEffect(() => {
    if (!familyId || ctxLoadedRef.current) return;
    ctxLoadedRef.current = true;
    refreshContext();
  }, [familyId, refreshContext]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, localMessages]);

  // ── wrapWithHeader ──────────────────────────────────────────────────────────
  // Prepends identity + context block to the first message sent to the LLM.
  // All subsequent calls pass the message through unchanged.
  const wrapWithHeader = useCallback((msg) => {
    if (headerInjectedRef.current) return msg;
    headerInjectedRef.current = true;
    const header = identityHeaderRef.current;
    const ctxBlock = ctxPayloadRef.current
      ? `\n<<<SYSTEM_METADATA_BEGIN>>>${JSON.stringify(ctxPayloadRef.current)}<<<SYSTEM_METADATA_END>>>`
      : '';
    return `${header}${ctxBlock}\n\n${msg}`;
  }, []);

  // ── sendMessage ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending || !conversation) return;
    setInput('');
    setSending(true);

    const now = new Date().toISOString();

    // 1) ALWAYS try the deterministic router first — LLM is last resort only.
    //    Use ctx state if available; fall back to ctxPayloadRef (set synchronously
    //    on load, so it may be ready even before the React state update propagates).
    try {
      const ctxForRouter = ctx || ctxPayloadRef.current;
      // Pass full person objects so detectIntent can match both id and name.
      const knownPersonNames = Array.isArray(persons) ? persons.filter(Boolean) : [];
      // Always ensure family.id is available so respondToIntent can call backend
      // functions even if getAssistantContext hasn't finished loading yet.
      const routerCtx = {
        ...(ctxForRouter || {}),
        family: ctxForRouter?.family || { id: familyId },
        knownPersonNames,
        authPersonId: personId,
      };

      const match = detectIntent(msg, routerCtx);
      // detectIntent already enforces internal confidence thresholds and returns
      // null for ambiguous cases — no secondary threshold check needed here.
      // respondToIntent guards familyId internally and returns null when ctx is insufficient.
      if (match) {
        const reply = await respondToIntent(match.intent, match.params, routerCtx, activeLocale);
        if (reply) {
          setLocalMessages((prev) => [
            ...prev,
            { role: 'user', content: msg, created_at: now },
            { role: 'assistant', content: reply, created_at: now },
          ]);
          // Fire-and-forget audit trail (REGLA #-1 returns empty on server side).
          base44.agents.addMessage(conversation, {
            role: 'user',
            content: wrapWithHeader(`[CLIENT_RESOLVED: ${match.intent}] ${msg}`),
          }).catch(() => {});
          // Silently refresh context so the next LLM turn has up-to-date balances.
          if (match.intent === 'register_expense' || match.intent === 'register_income') {
            refreshContext();
          }
          setSending(false);
          return;
        }
      }
    } catch (err) {
      console.warn('intent router failed, falling back to LLM', err);
    }

    // 2) LLM fallback — only reached when detectIntent returns null (no recognized
    //    intent) or respondToIntent returns null (router matched but can't respond).
    setLocalMessages((prev) => [...prev, { role: 'user', content: msg, created_at: now }]);

    const isAnalyticalQuery = /[?¿]|cu[aá]nto|how much|qu[eé]|what|cu[aá]l|which|saldo|balance|total|gasto|spent|llevo/i.test(msg);
    const backendMsg = isAnalyticalQuery
      ? `${msg}\n\n[SYSTEM OVERRIDE: This is an analytical query. YOU ARE STRICTLY FORBIDDEN from doing mathematical calculations or estimating totals by reading the transaction history. YOU MUST invoke a database Tool Call to get the data. If you don't have a tool for this or it fails, reply EXACTLY: 'I do not have the exact updated figure at this moment.']`
      : msg;

    await base44.agents.addMessage(conversation, { role: 'user', content: wrapWithHeader(backendMsg) });
    setSending(false);
  }, [input, sending, ctx, persons, activeLocale, conversation, wrapWithHeader, refreshContext]);

  const handleConfirmTransaction = async () => {
    if (!conversation || sending) return;
    const msg = 'Sí, confirmo';
    const now = new Date().toISOString();
    setLocalMessages((prev) => [...prev, { role: 'user', content: msg, created_at: now }]);
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: wrapWithHeader(msg) });
    setSending(false);
  };

  const handleModifyTransaction = async () => {
    if (!conversation || sending) return;
    const msg = 'No, quiero modificar los datos';
    const now = new Date().toISOString();
    setLocalMessages((prev) => [...prev, { role: 'user', content: msg, created_at: now }]);
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: wrapWithHeader(msg) });
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

  // ── handleScanComplete ──────────────────────────────────────────────────────
  // Called by ReceiptScanButton when the vision API returns a parsed receipt.
  // Injects the structured data into the chat via sendMessage (existing flow).
  const handleScanComplete = (parsed) => {
    const isEn = activeLocale.startsWith('en');
    const summary = isEn
      ? `Scanned receipt: ${parsed.merchant ?? '?'}, ${parsed.amount ?? '?'} ${parsed.currency ?? ''}, ${parsed.date ?? '?'}`
      : `Escaneé un ticket: ${parsed.merchant ?? '?'}, ${parsed.amount ?? '?'} ${parsed.currency ?? ''}, ${parsed.date ?? '?'}`;
    const metadata = `<<<SYSTEM_METADATA_BEGIN>>>${JSON.stringify({ receipt_scan: parsed })}<<<SYSTEM_METADATA_END>>>`;
    const userPrompt = isEn
      ? `${metadata}\n\n${summary}. Please log this expense.`
      : `${metadata}\n\n${summary}. Por favor regístralo como gasto.`;

    const scanThumbCaption = isEn ? 'Scanned receipt' : 'Ticket escaneado';

    // Immediately show a thumbnail bubble so the user sees what was sent.
    setLocalMessages((prev) => [
      ...prev,
      {
        role: 'user',
        kind: 'receipt',
        thumbnailDataUrl: parsed.thumbnailUrl,
        summary,
        content: scanThumbCaption,
        created_at: new Date().toISOString(),
      },
    ]);

    sendMessage(userPrompt);
  };

  // Merge LLM-subscribed assistant messages with locally-resolved messages for a
  // unified timeline sorted by created_at.
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
                {msg.kind === 'receipt' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[70%] bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-sm overflow-hidden">
                      {msg.thumbnailDataUrl && (
                        <img src={msg.thumbnailDataUrl} alt={msg.content} className="w-full max-h-40 object-cover" />
                      )}
                      <p className="text-xs text-primary px-3 py-1.5 font-medium">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <MessageBubble message={msg} />
                )}
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
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-muted-foreground/60"
                    animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.25, 1] }}
                    transition={{ duration: 1.4, delay: i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ))}
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
          <ReceiptScanButton
            onScanComplete={handleScanComplete}
            disabled={sending || !conversation}
            locale={activeLocale}
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || sending}
            className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 transition-all">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
