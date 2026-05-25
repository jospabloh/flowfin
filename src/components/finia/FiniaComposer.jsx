import { useRef, useState, useCallback } from 'react';
import { Send, Mic, MicOff, Paperclip, Camera, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import FiniaQuickChips from './FiniaQuickChips';

export default function FiniaComposer({ onSend, disabled, showChips }) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported] = useState(() => !!(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition));
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleSend = useCallback(() => {
    const msg = input.trim();
    if (!msg || disabled) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = '46px';
    onSend(msg);
  }, [input, disabled, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Voice
  const startVoice = () => {
    const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = 'es-MX';
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    r.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setTimeout(adjustHeight, 0);
    };
    r.start();
    recognitionRef.current = r;
  };
  const stopVoice = () => { recognitionRef.current?.stop(); setIsListening(false); };

  // File upload for receipts
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploadPreview({ url: file_url, name: file.name });
    } catch {
      // silently fail — user can still type
    } finally {
      setUploading(false);
    }
  };

  const sendWithImage = () => {
    if (!uploadPreview) return;
    const msg = input.trim()
      ? `${input.trim()}\n[Imagen: ${uploadPreview.url}]`
      : `[Imagen adjunta: ${uploadPreview.url}]\nPor favor analiza este recibo y prepara el borrador del gasto.`;
    setInput('');
    setUploadPreview(null);
    if (textareaRef.current) textareaRef.current.style.height = '46px';
    onSend(msg);
  };

  const canSend = (input.trim() || uploadPreview) && !disabled;

  return (
    <div className="flex-shrink-0 bg-background/95 backdrop-blur-sm border-t border-border">
      {/* Quick chips — only shown when no messages yet or always */}
      {showChips && (
        <div className="pt-2 pb-1">
          <FiniaQuickChips onAction={(text) => onSend(text)} disabled={disabled} />
        </div>
      )}

      {/* Upload preview */}
      <AnimatePresence>
        {uploadPreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-2 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm flex-shrink-0">
              🧾
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{uploadPreview.name}</p>
              <p className="text-[10px] text-muted-foreground">Imagen lista para analizar</p>
            </div>
            <button
              onClick={() => setUploadPreview(null)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Listening indicator */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-2 flex items-center gap-2 bg-destructive/5 border border-destructive/20 rounded-xl px-3 py-2"
          >
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <motion.div
                  key={i}
                  className="w-1 h-4 rounded-full bg-destructive"
                  animate={{ scaleY: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
                />
              ))}
            </div>
            <p className="text-xs text-destructive font-medium">Escuchando... habla ahora</p>
            <button onClick={stopVoice} className="ml-auto text-xs text-muted-foreground underline">Cancelar</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer row */}
      <div className="flex items-end gap-2 px-3 py-2.5">
        {/* Attach buttons */}
        <div className="flex gap-1 flex-shrink-0 pb-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground hover:bg-accent transition-all active:scale-95 disabled:opacity-40"
            title="Adjuntar imagen o recibo"
          >
            {uploading
              ? <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              : <Paperclip className="w-[18px] h-[18px]" />
            }
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => { setInput(e.target.value); adjustHeight(); }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Escribe o habla con Finia…"
            className="w-full bg-muted/60 border border-border focus:border-primary/40 rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/15 resize-none leading-relaxed transition-all disabled:opacity-50"
            style={{ minHeight: '46px', maxHeight: '120px', overflowY: 'auto' }}
          />
        </div>

        {/* Right action buttons */}
        <div className="flex gap-1 flex-shrink-0 pb-1">
          {/* Voice — only if supported */}
          {voiceSupported && (
            <button
              onClick={isListening ? stopVoice : startVoice}
              disabled={disabled}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 ${
                isListening
                  ? 'bg-destructive text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title={isListening ? 'Detener' : 'Hablar'}
            >
              {isListening ? <MicOff className="w-[18px] h-[18px]" /> : <Mic className="w-[18px] h-[18px]" />}
            </button>
          )}

          {/* Send */}
          {uploadPreview ? (
            <button
              onClick={sendWithImage}
              disabled={!canSend}
              className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary text-primary-foreground disabled:opacity-40 transition-all active:scale-95 shadow-sm"
              title="Enviar con imagen"
            >
              <Send className="w-[18px] h-[18px]" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary text-primary-foreground disabled:opacity-40 transition-all active:scale-95 shadow-sm hover:bg-primary/90"
              title="Enviar"
            >
              <Send className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
      </div>

      {/* Trust footer — no extra safe-area here; container already accounts for keyboard */}
      <div className="pb-1">
        <p className="text-[10px] text-muted-foreground/50 text-center pb-1">
          🔒 Finia solo accede a los datos de tu familia
        </p>
      </div>
    </div>
  );
}