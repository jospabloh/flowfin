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
  // llmMessages: only assistant messages from the LLM subscription (server-side, in order)
  const [llmMessages, setLlmMessages] = useState([]);
  // localPairs: {id, userMsg, botMsg?} — local resolved intent pairs, in insertion order
  const [localPairs, setLocalPairs] = useState([]);
  // llmUserMessages: user messages sent to the LLM (to show them before the bot replies)
  const [llmUserMessages, setLlmUserMessages] = useState([]);
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
      setLlmMessages(c.messages?.filter(m => (m.content || '').trim()) || []);
    });
  }, [currentUser]);

  // Subscribe to conversation updates from the LLM.
  // We receive all messages in order. We filter out empty assistant messages.
  // User messages from the LLM flow are tracked separately so we can pair them with bot replies.
  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const msgs = (data.messages || []).filter((m) => (m.content || '').trim());
      setLlmMessages(msgs);
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
  }, [llmMessages, localPairs, llmUserMessages]);

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
          const pairId = now + Math.random();
          setLocalPairs((prev) => [
            ...prev,
            { id: pairId, userMsg: { role: 'user', content: msg }, botMsg: { role: 'assistant', content: reply } },
          ]);
          // Fire-and-forget audit trail
          base44.agents.addMessage(conversation, {
            role: 'user',
            content: wrapWithHeader(`[CLIENT_RESOLVED: ${match.intent}] ${msg}`),
          }).catch(() => {});
          const isWriteIntent = match.intent === 'register_expense' || match.intent === 'register_income';
          if (isWriteIntent) refreshContext();
          setSending(false);
          return;
        }
      }
    } catch (err) {
      console.warn('intent router failed, falling back to LLM', err);
    }

    // 2) LLM fallback — show user message immediately (display only the original text, not the header)
    setLlmUserMessages((prev) => [...prev, { role: 'user', content: msg, _localId: now }]);

    await base44.agents.addMessage(conversation, { role: 'user', content: wrapWithHeader(msg) });
    setSending(false);
  }, [input, sending, ctx, persons, activeLocale, conversation, wrapWithHeader, refreshContext]);

  const handleConfirmTransaction = async () => {
    if (!conversation || sending) return;
    const msg = 'Sí, confirmo';
    const now = new Date().toISOString();
    setLlmUserMessages((prev) => [...prev, { role: 'user', content: msg, _localId: now }]);
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: wrapWithHeader(msg) });
    setSending(false);
  };

  const handleModifyTransaction = async () => {
    if (!conversation || sending) return;
    const msg = 'No, quiero modificar los datos';
    const now = new Date().toISOString();
    setLlmUserMessages((prev) => [...prev, { role: 'user', content: msg, _localId: now }]);
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
    setLlmUserMessages((prev) => [
      ...prev,
      {
        role: 'user',
        kind: 'receipt',
        thumbnailDataUrl: parsed.thumbnailUrl,
        summary,
        content: scanThumbCaption,
        _localId: new Date().toISOString(),
      },
    ]);

    sendMessage(userPrompt);
  };

  // Build the final ordered message list:
  // 1. LLM messages come from the server subscription already in correct order.
  //    We merge llmUserMessages (shown immediately) with llmMessages (from server).
  //    Once the server has the user message, we drop the local copy to avoid duplicates.
  // Strip internal system headers and metadata blocks before displaying
  function cleanUserContent(raw) {
    if (!raw) return '';
    let s = raw;

    // 1. Remove SYSTEM_METADATA JSON block (can be very large)
    s = s.replace(/<<<SYSTEM_METADATA_BEGIN>>>[\s\S]*?<<<SYSTEM_METADATA_END>>>/g, '');

    // 2. If message starts with internal header tags, strip everything up to the last \n\n
    //    (the actual user text always comes after the header block)
    const headerPattern = /^\s*\[(?:LOCALE|CLIENT_RESOLVED|FAMILY_ID|PERSON_ID|PERSON_NAME|FAMILY_NAME|UNLINKED_USER|SYSTEM_CONTEXT):/;
    if (headerPattern.test(s)) {
      const lastDouble = s.lastIndexOf('\n\n');
      s = lastDouble !== -1 ? s.slice(lastDouble + 2) : '';
    }

    s = s.trim();

    // 3. Safety: if what remains still looks like raw JSON or a system tag, hide it
    if (s.startsWith('{') || s.startsWith('[{') || /^\[(?:LOCALE|FAMILY|PERSON|SYSTEM)/.test(s)) {
      return '';
    }

    return s;
  }

  const serverUserContents = new Set(
    llmMessages.filter(m => m.role === 'user').map(m => cleanUserContent(m.content))
  );
  const pendingLlmUserMsgs = llmUserMessages.filter(m => !serverUserContents.has(cleanUserContent(m.content)));

  // Clean server user messages before display (strip internal headers/metadata)
  // Filter out messages that become empty after cleaning (pure system/context messages)
  const cleanedLlmMessages = llmMessages
    .map(m => m.role === 'user' ? { ...m, content: cleanUserContent(m.content) } : m)
    .filter(m => m.role !== 'user' || (m.content && m.content.trim().length > 0));

  // Interleave: server messages are authoritative; pending local user msgs go at the end
  const llmTimeline = [...cleanedLlmMessages, ...pendingLlmUserMsgs];

  // 2. Local intent pairs (user + bot) are appended in insertion order after LLM timeline
  const localTimeline = localPairs.flatMap(p => [p.userMsg, p.botMsg]);

  const allMessages = [...llmTimeline, ...localTimeline];

  if (!conversation) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 130px)' }}>
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
      <div className="flex-1 overflow-y-auto px-4 py-3">
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
            const prevMsg = allMessages[i - 1];
            const isGrouped = prevMsg && prevMsg.role === msg.role;

            return (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={isGrouped ? 'mt-1' : 'mt-3'}>
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
                  <MessageBubble message={msg} hideAvatar={isGrouped} />
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
      <div className="px-4 pb-4 pb-safe pt-2 border-t border-border">
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