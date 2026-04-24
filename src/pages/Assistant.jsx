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
  // allMessages: single source of truth for displayed messages, in insertion order
  // Each entry: { id, role, content, kind?, thumbnailDataUrl?, source: 'local'|'llm', ts }
  const [displayMessages, setDisplayMessages] = useState([]);
  // Track server-confirmed message ids to avoid duplication
  const serverMsgIdsRef = useRef(new Set());
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ctx, setCtx] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const inputBarRef = useRef(null);
  const recognitionRef = useRef(null);
  const containerRef = useRef(null);

  // Active locale: familyConfig > browser > fallback es-MX
  const activeLocale = familyConfig?.locale || navigator?.language || 'es-MX';
  const voiceLang = activeLocale.startsWith('en') ? 'en-US' : activeLocale;

  // Strip internal system headers/metadata from user message content for display
  function cleanContent(raw) {
    if (!raw) return '';
    let s = raw;
    s = s.replace(/<<<SYSTEM_METADATA_BEGIN>>>[\s\S]*?<<<SYSTEM_METADATA_END>>>/g, '');
    s = s.replace(/^\s*\[CLIENT_RESOLVED:[^\]]*\]\s*/g, '');
    const headerPattern = /^\s*\[(?:LOCALE|FAMILY_ID|PERSON_ID|PERSON_NAME|FAMILY_NAME|UNLINKED_USER|SYSTEM_CONTEXT):/;
    if (headerPattern.test(s)) {
      const lastDouble = s.lastIndexOf('\n\n');
      s = lastDouble !== -1 ? s.slice(lastDouble + 2) : '';
    }
    s = s.trim();
    if (s.startsWith('{') || s.startsWith('[{') || /^\[(?:LOCALE|FAMILY|PERSON|SYSTEM|CLIENT)/.test(s)) return '';
    return s;
  }

  // Create a fresh conversation on mount — no messages sent here.
  useEffect(() => {
    if (!currentUser) return;
    const sessionDate = new Date().toLocaleDateString(activeLocale);
    base44.agents.createConversation({
      agent_name: 'finance_assistant',
      metadata: { name: `Sesión ${sessionDate}`, locale: activeLocale, family_id: familyId }
    }).then(c => {
      setConversation(c);
      // Load any existing messages (e.g. page refresh)
      const existing = (c.messages || []).filter(m => (m.content || '').trim());
      if (existing.length > 0) {
        const msgs = existing
          .map((m, i) => ({
            id: m.id || `init-${i}`,
            role: m.role,
            content: m.role === 'user' ? cleanContent(m.content) : m.content,
            source: 'llm',
            ts: i,
          }))
          .filter(m => m.role !== 'user' || m.content);
        setDisplayMessages(msgs);
        msgs.forEach(m => serverMsgIdsRef.current.add(m.id));
      }
    });
  }, [currentUser]);

  // Subscribe to conversation updates — merge new LLM messages into displayMessages
  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const msgs = (data.messages || []).filter(m => (m.content || '').trim());
      setDisplayMessages(prev => {
        const newMsgs = [];
        for (const m of msgs) {
          const msgId = m.id || m._id;
          if (!msgId) continue;
          if (serverMsgIdsRef.current.has(msgId)) continue;
          // Skip audit trail user messages (CLIENT_RESOLVED) — they clean to empty
          const content = m.role === 'user' ? cleanContent(m.content) : m.content;
          if (!content && m.role === 'user') continue;
          serverMsgIdsRef.current.add(msgId);
          newMsgs.push({ id: msgId, role: m.role, content, source: 'llm', ts: Date.now() + newMsgs.length });
        }

        if (newMsgs.length === 0) {
          // Streaming update: update content of last known llm assistant message
          const lastServerAssistant = [...msgs].reverse().find(m => m.role === 'assistant');
          if (!lastServerAssistant) return prev;
          const lastServerId = lastServerAssistant.id || lastServerAssistant._id;
          // Find it in prev and update if content changed
          const idx = prev.findIndex(m => m.id === lastServerId);
          if (idx === -1) return prev;
          if (prev[idx].content === lastServerAssistant.content) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx], content: lastServerAssistant.content };
          return updated;
        }

        // New messages from server: insert them between existing server msgs and local msgs
        // Local user messages that are now confirmed by server will be deduplicated in render
        const localOnly = prev.filter(m => m.source === 'local');
        const serverPrev = prev.filter(m => m.source === 'llm');
        return [...serverPrev, ...newMsgs, ...localOnly];
      });
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
  }, [displayMessages]);

  // Keep input bar visible on iOS and other devices
  useEffect(() => {
    const handleFocus = () => {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
      }, 300);
    };
    
    const input = inputRef.current;
    if (input) {
      input.addEventListener('focus', handleFocus);
      return () => input.removeEventListener('focus', handleFocus);
    }
  }, []);

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

    const now = Date.now();
    const localUserMsgId = `local-user-${now}`;

    // Add user message to display immediately
    setDisplayMessages(prev => [
      ...prev,
      { id: localUserMsgId, role: 'user', content: msg, source: 'local', ts: now }
    ]);

    // 1) ALWAYS try the deterministic router first
    try {
      const ctxForRouter = ctx || ctxPayloadRef.current;
      const knownPersonNames = Array.isArray(persons) ? persons.filter(Boolean) : [];
      const routerCtx = {
        ...(ctxForRouter || {}),
        family: ctxForRouter?.family || { id: familyId },
        knownPersonNames,
        authPersonId: personId,
      };

      const match = detectIntent(msg, routerCtx);
      if (match) {
        const reply = await respondToIntent(match.intent, match.params, routerCtx, activeLocale);
        if (reply) {
          const botMsgId = `local-bot-${now}`;
          // Replace the local user message and add bot response, both marked local
          setDisplayMessages(prev => [
            ...prev.filter(m => m.id !== localUserMsgId),
            { id: localUserMsgId, role: 'user', content: msg, source: 'local', ts: now },
            { id: botMsgId, role: 'assistant', content: reply, source: 'local', ts: now + 1 },
          ]);
          // Fire-and-forget audit trail to LLM (won't appear in display since it becomes empty after clean)
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

    // 2) LLM fallback — user message already in display, now send to LLM
    await base44.agents.addMessage(conversation, { role: 'user', content: wrapWithHeader(msg) });
    setSending(false);
  }, [input, sending, ctx, persons, activeLocale, conversation, wrapWithHeader, refreshContext]);

  const handleConfirmTransaction = async () => {
    if (!conversation || sending) return;
    const msg = 'Sí, confirmo';
    const now = Date.now();
    setDisplayMessages(prev => [...prev, { id: `local-user-${now}`, role: 'user', content: msg, source: 'local', ts: now }]);
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: wrapWithHeader(msg) });
    setSending(false);
  };

  const handleModifyTransaction = async () => {
    if (!conversation || sending) return;
    const msg = 'No, quiero modificar los datos';
    const now = Date.now();
    setDisplayMessages(prev => [...prev, { id: `local-user-${now}`, role: 'user', content: msg, source: 'local', ts: now }]);
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
    const now = Date.now();
    setDisplayMessages(prev => [...prev, {
      id: `local-receipt-${now}`,
      role: 'user',
      kind: 'receipt',
      thumbnailDataUrl: parsed.thumbnailUrl,
      summary,
      content: scanThumbCaption,
      source: 'local',
      ts: now,
    }]);

    sendMessage(userPrompt);
  };

  // Deduplicate: if a local message was confirmed by server (same cleaned content), remove the local one
  const allMessages = (() => {
    const serverUserContents = new Set(
      displayMessages.filter(m => m.source === 'llm' && m.role === 'user').map(m => m.content)
    );
    return displayMessages.filter(m => {
      if (m.source === 'local' && m.role === 'user' && !m.kind) {
        return !serverUserContents.has(m.content);
      }
      return true;
    });
  })();

  if (!conversation) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div ref={containerRef} className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-bold text-foreground text-sm">Asistente IA</h1>
          <p className="text-xs text-muted-foreground">Tu asistente financiero personal</p>
        </div>
      </div>

      {/* Messages — scrollable, respecting input + nav */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 pb-20"
      >
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
          <div className="flex gap-2 mt-3">
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

      {/* Input — in flow, respects nav spacing */}
      <div
        ref={inputBarRef}
        className="fixed bottom-22 left-0 right-0 px-4 pt-2 border-t border-border bg-background z-40"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex gap-2 items-center max-w-full">
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)}
            placeholder="Escribe o habla tu transacción..."
            className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 min-w-0" />
          <button onClick={isListening ? stopVoice : startVoice}
            className={`flex-shrink-0 p-3 rounded-xl transition-all ${isListening ? 'bg-expense text-white animate-pulse-ring' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <ReceiptScanButton
            onScanComplete={handleScanComplete}
            disabled={sending || !conversation}
            locale={activeLocale}
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || sending}
            className="flex-shrink-0 p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 transition-all">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}