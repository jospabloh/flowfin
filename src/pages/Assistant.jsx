import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { Send, Mic, MicOff, Bot, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

export default function Assistant() {
  const { currentUser, familyId } = useFamily();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    base44.agents.createConversation({
      agent_name: 'finance_assistant',
      metadata: { name: `Sesión ${new Date().toLocaleDateString('es-MX')}` }
    }).then(c => {
      setConversation(c);
      setMessages(c.messages || []);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return unsub;
  }, [conversation?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: msg });
    setSending(false);
  };

  const handleConfirmTransaction = async () => {
    if (!pendingTransaction) return;
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: 'Sí, confirmo' });
    setPendingTransaction(null);
    setSending(false);
  };

  const handleModifyTransaction = async () => {
    if (!pendingTransaction) return;
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: 'No, quiero modificar' });
    setPendingTransaction(null);
    setSending(false);
  };

  const handleCancelTransaction = async () => {
    setMessages([]);
    setPendingTransaction(null);
    setInput('');
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta voz'); return; }
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

  const quickActions = [
    '💸 Gasté $500 en gasolina hoy',
    '🛒 $1,200 en el súper',
    '💰 Recibí mi quincena de $8,500',
    '📊 ¿Cuánto gasté esta semana?',
  ];

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
          <p className="text-xs text-muted-foreground">Registra gastos e ingresos conversando</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                <p className="text-sm text-foreground">¡Hola! 👋 Soy tu asistente financiero. Dime qué gastaste o recibiste y lo registro por ti automáticamente.</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">Acciones rápidas:</p>
            <div className="flex flex-col gap-2">
              {quickActions.map((a, i) => (
                <button key={i} onClick={() => sendMessage(a)}
                  className="text-left px-3 py-2.5 bg-muted rounded-xl text-sm text-foreground hover:bg-accent transition-colors border border-border">
                  {a}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm
                  ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border border-border text-foreground rounded-tl-sm'}`}>
                  {isUser ? (
                    <p>{msg.content}</p>
                  ) : (
                    <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
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

      {/* Confirmation */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="px-4 pt-2 pb-2 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">¿Confirmas este movimiento?</p>
            <div className="flex gap-2">
              <button onClick={confirmSend}
                className="flex-1 py-2.5 rounded-lg bg-income text-white text-sm font-semibold hover:bg-income/90 transition-colors">
                Sí
              </button>
              <button onClick={cancelSend}
                className="flex-1 py-2.5 rounded-lg bg-muted text-foreground text-sm font-semibold hover:bg-border transition-colors">
                No (Modificar)
              </button>
              <button onClick={() => { setShowConfirmation(false); setPendingMessage(''); setInput(''); }}
                className="flex-1 py-2.5 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors">
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-border">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !showConfirmation && handleSendWithConfirmation(input)}
            placeholder="Escribe o habla tu transacción..."
            className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={isListening ? stopVoice : startVoice}
            className={`p-3 rounded-xl transition-all ${isListening ? 'bg-expense text-white animate-pulse-ring' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button onClick={() => handleSendWithConfirmation(input)} disabled={!input.trim() || sending}
            className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 transition-all">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}