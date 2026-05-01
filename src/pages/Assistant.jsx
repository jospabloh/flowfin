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
import { usePermission, useCanView } from '@/lib/permissions/usePermission';

export default function Assistant() {
  const { currentUser, family, familyId, familyConfig, membership } = useFamily();
  const { persons } = useCatalog(familyId);
  const { can_write: canSend } = usePermission('assistant.chat.send');
  const { can_write: canUseVoice } = usePermission('assistant.chat.voice');
  const canViewChips = useCanView('assistant.features.predictive_chips');
  const [conversation, setConversation] = useState(null);
  // messages: array of { id, role, content, kind?, thumbnailDataUrl?, source: 'local'|'server', ts }
  const [messages, setMessages] = useState([]);
  // Track ids already added from server to avoid duplication
  const serverIdsRef = useRef(new Set());
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ctx, setCtx] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const inputBarRef = useRef(null);
  const recognitionRef = useRef(null);
  const containerRef = useRef(null);
  const scanButtonRef = useRef(null);

  // Active locale: familyConfig > browser > fallback es-MX
  const activeLocale = familyConfig?.locale || navigator?.language || 'es-MX';
  const voiceLang = activeLocale.startsWith('en') ? 'en-US' : activeLocale;

  // Strip internal system headers/metadata from user message content for display
  function cleanContent(raw) {
    if (!raw) return '';
    let s = raw;
    // Strip system metadata blocks
    s = s.replace(/<<<SYSTEM_METADATA_BEGIN>>>[\s\S]*?<<<SYSTEM_METADATA_END>>>/g, '');
    // Strip CLIENT_RESOLVED audit trail
    s = s.replace(/^\s*\[CLIENT_RESOLVED:[^\]]*\]\s*/g, '');
    // Strip RECEIPT_SCAN internal instruction
    s = s.replace(/^\s*\[RECEIPT_SCAN\]\s*/g, '');
    // If message starts with known system headers, strip everything up to the last \n\n
    const headerPattern = /^\s*\[(?:LOCALE|FAMILY_ID|PERSON_ID|PERSON_NAME|FAMILY_NAME|UNLINKED_USER|SYSTEM_CONTEXT):/;
    if (headerPattern.test(s)) {
      const lastDouble = s.lastIndexOf('\n\n');
      s = lastDouble !== -1 ? s.slice(lastDouble + 2) : '';
    }
    s = s.trim();
    if (s.startsWith('{') || s.startsWith('[{') || /^\[(?:LOCALE|FAMILY|PERSON|SYSTEM|CLIENT|RECEIPT)/.test(s)) return '';
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
          .map((m, i) => {
            const content = m.role === 'user' ? cleanContent(m.content) : m.content;
            if (m.role === 'user' && !content) return null;
            const id = m.id || `init-${i}`;
            serverIdsRef.current.add(id);
            return { id, role: m.role, content, source: 'server', ts: i };
          })
          .filter(Boolean);
        setMessages(msgs);
      }
    });
  }, [currentUser]);

  // Subscribe to conversation updates from server
  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const serverMsgs = (data.messages || []).filter(m => (m.content || '').trim());

      setMessages(prev => {
        let updated = [...prev];
        let changed = false;

        for (const m of serverMsgs) {
          const id = m.id || m._id;
          if (!id) continue;

          // Already tracked — check if streaming update needed
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

          // New message from server
          const content = m.role === 'user' ? cleanContent(m.content) : m.content;
          if (m.role === 'user' && !content) continue; // skip internal system messages

          serverIdsRef.current.add(id);

          // Remove any local optimistic message with the same content to avoid duplication
          const beforeLen = updated.length;
          updated = updated.filter(x => !(x.source === 'local' && x.role === m.role && x.content === content));
          if (updated.length < beforeLen) changed = true;

          updated = [...updated, { id, role: m.role, content, source: 'server', ts: Date.now() }];
          changed = true;
        }

        return changed ? updated : prev;
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
  }, [messages]);

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

  // ── handlePaste — intercept images pasted into the text input ───────────────
  const handlePaste = useCallback((e) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItem = items.find(item => item.kind === 'file' && item.type.startsWith('image/'));
    if (!imageItem) return; // plain-text paste — let input handle it normally
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file && scanButtonRef.current && !sending && conversation) {
      scanButtonRef.current.processFile(file);
    }
  }, [sending, conversation]);

  // ── sendMessage ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending || !conversation) return;
    setInput('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = '48px';
    }
    setSending(true);

    const now = Date.now();
    const localUserMsgId = `local-user-${now}`;

    // Add user message to display immediately (optimistic)
    setMessages(prev => [
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
          setMessages(prev => [
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
    setMessages(prev => [...prev, { id: `local-user-${now}`, role: 'user', content: msg, source: 'local', ts: now }]);
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: wrapWithHeader(msg) });
    setSending(false);
  };

  const handleModifyTransaction = async () => {
    if (!conversation || sending) return;
    const msg = 'No, quiero modificar los datos';
    const now = Date.now();
    setMessages(prev => [...prev, { id: `local-user-${now}`, role: 'user', content: msg, source: 'local', ts: now }]);
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: wrapWithHeader(msg) });
    setSending(false);
  };

  const startVoice = () => {
    const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
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
  // Shows a clean thumbnail bubble and sends metadata+context directly to LLM
  // WITHOUT adding another visible user message bubble.
  const handleScanComplete = async (parsed) => {
    if (!conversation || sending) return;
    const isEn = activeLocale.startsWith('en');
    const transactions = parsed.transactions || [parsed];
    const count = transactions.length;

    // Build a human-readable summary of what was found
    const summary = count > 1
      ? (isEn
          ? `Scanned image: found ${count} transactions. ${transactions.map(t => `${t.merchant ?? '?'} $${t.amount ?? '?'} (${t.date ?? '?'})`).join(', ')}.`
          : `Imagen escaneada: encontré ${count} transacciones. ${transactions.map(t => `${t.merchant ?? '?'} $${t.amount ?? '?'} (${t.date ?? '?'})`).join(', ')}.`)
      : (isEn
          ? `Scanned receipt: ${parsed.merchant ?? '?'}, $${parsed.amount ?? '?'} ${parsed.currency ?? ''}, ${parsed.date ?? '?'}`
          : `Ticket escaneado: ${parsed.merchant ?? '?'}, $${parsed.amount ?? '?'} ${parsed.currency ?? ''}, ${parsed.date ?? '?'}`);

    // 1. Show thumbnail bubble immediately (clean, no JSON)
    const now = Date.now();
    setMessages(prev => [...prev, {
      id: `local-receipt-${now}`,
      role: 'user',
      kind: 'receipt',
      thumbnailDataUrl: parsed.thumbnailUrl,
      summary,
      content: isEn ? 'Scanned image' : 'Imagen escaneada',
      source: 'local',
      ts: now,
    }]);

    // 2. Send to LLM with metadata hidden — the content is NOT shown as a user bubble
    //    because cleanContent strips everything before \n\n and the instructions block
    setSending(true);
    const metadata = `<<<SYSTEM_METADATA_BEGIN>>>${JSON.stringify({ receipt_scan: parsed, all_transactions: transactions })}<<<SYSTEM_METADATA_END>>>`;
    const instruction = isEn
      ? `${metadata}\n\n[RECEIPT_SCAN] ${summary}. Read Category and Person entities. Then show a confirmation summary for ALL ${count} transaction(s) and ask who they belong to before saving. Do NOT save yet.`
      : `${metadata}\n\n[RECEIPT_SCAN] ${summary}. Lee las entidades Category y Person. Luego muestra un resumen de confirmación de TODAS las ${count} transacción(es) y pregúntame a quién pertenecen antes de guardar. NO guardes todavía.`;

    await base44.agents.addMessage(conversation, {
      role: 'user',
      content: wrapWithHeader(instruction),
    });
    setSending(false);
  };

  // Detect if last assistant message is asking who the expense belongs to (person chips)
  const personQuestionChips = (() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant?.content) return null;
    const c = lastAssistant.content;
    const isPersonQuestion =
      /¿a\s*qui[eé]n\s*pertenece/.test(c.toLowerCase()) ||
      /¿de\s*qui[eé]n\s*es/.test(c.toLowerCase()) ||
      /¿es\s*de\s*\w+\s*o\s*\w+\?/i.test(c) ||
      /¿para\s*qui[eé]n/.test(c.toLowerCase()) ||
      /who\s*(is\s*this|does\s*this\s*belong)/i.test(c) ||
      (/¿[^?]*\s*o\s*[^?]*\?/.test(c) && persons?.some(p => c.toLowerCase().includes(p.name.toLowerCase())));
    if (!isPersonQuestion) return null;
    if (!persons || persons.length === 0) return null;
    return persons.map(p => ({ id: p.id, name: p.name }));
  })();

  // Detect if last assistant message is a confirmation question (Sí/No chips)
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const isLastMsgConfirmation = !sending && lastAssistantMsg && (
    lastAssistantMsg.content?.includes('¿Confirmas') ||
    lastAssistantMsg.content?.includes('¿Lo guardo') ||
    lastAssistantMsg.content?.includes('¿Los guardo') ||
    lastAssistantMsg.content?.includes('¿Guardamos') ||
    lastAssistantMsg.content?.includes('Confirm?') ||
    lastAssistantMsg.content?.includes('Shall I save')
  );

  if (!conversation) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div ref={containerRef} className="flex flex-col h-full min-h-0 relative overflow-hidden">
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

      {/* Messages — scrollable area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-4">
        {messages.length === 0 && (
          <AssistantWelcome
            ctx={ctx}
            locale={activeLocale}
            onAction={(intent) => sendMessage(intent)}
          />
        )}

        <AnimatePresence>
          {messages.map((msg, i) => {
            const prevMsg = messages[i - 1];
            const isGrouped = prevMsg && prevMsg.role === msg.role;

            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
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

      {/* Action chips — shown above input bar, never hidden by sending state */}
      {(isLastMsgConfirmation || (canViewChips && personQuestionChips && !sending)) && (
        <div className="flex-shrink-0 px-4 pb-2 pt-2 border-t border-border bg-background flex flex-wrap gap-2">
          {isLastMsgConfirmation && (
            <>
              <button onClick={handleConfirmTransaction}
                className="flex-1 py-2.5 rounded-xl bg-income text-white text-sm font-semibold hover:bg-income/90 transition-colors">
                ✅ Sí, guardar
              </button>
              <button onClick={handleModifyTransaction}
                className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-border transition-colors">
                ✏️ No, modificar
              </button>
            </>
          )}
          {!isLastMsgConfirmation && personQuestionChips && personQuestionChips.map(p => (
            <button
              key={p.id}
              onClick={() => sendMessage(p.name)}
              className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Input — in-flow at bottom. On mobile, bottom padding accounts for fixed nav bar (~64px) + safe area */}
      <div
        ref={inputBarRef}
        className="flex-shrink-0 px-4 pt-2 border-t border-border bg-background assistant-input-bar"
      >
        <div className="flex gap-2 items-end max-w-full">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              // Auto-grow
              const el = e.target;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
            onKeyDown={e => {
              // Enter sin Shift: nueva línea (no envía)
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const el = e.target;
                const start = el.selectionStart;
                const end = el.selectionEnd;
                const newVal = input.slice(0, start) + '\n' + input.slice(end);
                setInput(newVal);
                // Re-calcular altura tras el estado nuevo
                setTimeout(() => {
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                  el.selectionStart = el.selectionEnd = start + 1;
                }, 0);
              }
            }}
            onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)}
            onPaste={handlePaste}
            placeholder="Escribe tu mensaje..."
            className="flex-1 bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 min-w-0 resize-none leading-relaxed"
            style={{ minHeight: '48px', maxHeight: '120px', overflowY: 'auto' }}
          />
          {canUseVoice && (
            <button onClick={isListening ? stopVoice : startVoice}
              className={`flex-shrink-0 p-3 rounded-xl transition-all ${isListening ? 'bg-expense text-white animate-pulse-ring' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <ReceiptScanButton
            ref={scanButtonRef}
            onScanComplete={handleScanComplete}
            disabled={sending || !conversation}
            locale={activeLocale}
          />
          {canSend && (
            <button onClick={() => sendMessage(input)} disabled={!input.trim() || sending}
              className="flex-shrink-0 p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 transition-all">
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}