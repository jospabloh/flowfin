import { useRef, useState, useCallback, useEffect } from 'react';
import { Send, Mic, MicOff, Paperclip, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import FiniaQuickChips from './FiniaQuickChips';

// Accepted attachment types: images plus common document formats.
const ATTACHMENT_ACCEPT = 'image/*,.txt,.md,.csv,.doc,.docx,.xls,.xlsx';

// Categorize a file into a kind/label/emoji for the preview UI and message text.
function describeFile(file) {
  const name = file?.name || '';
  const type = file?.type || '';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (type.startsWith('image/')) return { kind: 'image', label: 'Imagen', emoji: '🧾' };
  if (ext === 'csv' || type === 'text/csv') return { kind: 'document', label: 'CSV', emoji: '📊' };
  if (ext === 'xls' || ext === 'xlsx' || type.includes('excel') || type.includes('spreadsheet'))
    return { kind: 'document', label: 'Excel', emoji: '📊' };
  if (ext === 'doc' || ext === 'docx' || type.includes('word'))
    return { kind: 'document', label: 'Documento', emoji: '📄' };
  if (ext === 'md') return { kind: 'document', label: 'Markdown', emoji: '📝' };
  if (ext === 'txt' || type === 'text/plain') return { kind: 'document', label: 'Texto', emoji: '📄' };
  return { kind: 'document', label: 'Archivo', emoji: '📎' };
}

export default function FiniaComposer({ onSend, disabled, showChips, lastAssistantMessage }) {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [voiceSupported] = useState(() =>
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
  const [uploading, setUploading] = useState(false);
  const [uploadPreviews, setUploadPreviews] = useState([]);
  const lastEnterWasNewLine = useRef(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

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

  // 1st Enter → new line, 2nd consecutive Enter → send
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (lastEnterWasNewLine.current) {
        // 2nd Enter: trim the trailing newline we added, then send
        lastEnterWasNewLine.current = false;
        const trimmed = input.replace(/\n$/, '');
        if (!trimmed || disabled) return;
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = '46px';
        onSend(trimmed);
      } else {
        // 1st Enter: insert newline
        lastEnterWasNewLine.current = true;
        setInput(prev => prev + '\n');
        setTimeout(adjustHeight, 0);
      }
    } else {
      // Any other key resets the double-enter tracker
      lastEnterWasNewLine.current = false;
    }
  }, [input, disabled, onSend]);

  // Voice — record audio with MediaRecorder, then transcribe via Whisper (TranscribeAudio).
  // Works on iOS Safari, Android Chrome, desktop Chrome/Firefox/Safari.
  const cleanupStream = () => {
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  const pickMimeType = () => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    for (const m of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return m;
    }
    return ''; // let browser pick
  };

  const extFromMime = (mime) => {
    if (!mime) return 'webm';
    if (mime.includes('mp4')) return 'm4a';
    if (mime.includes('ogg')) return 'ogg';
    return 'webm';
  };

  const startVoice = async () => {
    setVoiceError(null);
    if (!voiceSupported) {
      setVoiceError('Tu navegador no soporta grabación de audio.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        const chunks = audioChunksRef.current;
        const usedMime = rec.mimeType || mimeType || 'audio/webm';
        cleanupStream();
        if (!chunks.length) { setIsRecording(false); return; }
        const blob = new Blob(chunks, { type: usedMime });
        if (blob.size < 1000) {
          setIsRecording(false);
          setVoiceError('La grabación fue muy corta. Intenta de nuevo.');
          setTimeout(() => setVoiceError(null), 3000);
          return;
        }
        const ext = extFromMime(usedMime);
        const file = new File([blob], `finia-audio-${Date.now()}.${ext}`, { type: usedMime });
        setIsRecording(false);
        setIsTranscribing(true);
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          const transcript = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
          const text = typeof transcript === 'string' ? transcript : (transcript?.text || '');
          if (text?.trim()) {
            setInput(prev => (prev ? `${prev} ${text.trim()}` : text.trim()));
            setTimeout(adjustHeight, 0);
          } else {
            setVoiceError('No pude entender el audio. Intenta de nuevo.');
            setTimeout(() => setVoiceError(null), 3000);
          }
        } catch (err) {
          setVoiceError('Error al transcribir. Intenta de nuevo.');
          setTimeout(() => setVoiceError(null), 3000);
        } finally {
          setIsTranscribing(false);
        }
      };

      rec.start();
      mediaRecorderRef.current = rec;
      setIsRecording(true);
    } catch (err) {
      cleanupStream();
      setIsRecording(false);
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setVoiceError('Permiso de micrófono denegado. Habilítalo en los ajustes del navegador.');
      } else if (err?.name === 'NotFoundError') {
        setVoiceError('No se encontró ningún micrófono.');
      } else {
        setVoiceError('No se pudo iniciar la grabación.');
      }
      setTimeout(() => setVoiceError(null), 4000);
    }
  };

  const stopVoice = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        cleanupStream();
        setIsRecording(false);
      }
    } catch {
      cleanupStream();
      setIsRecording(false);
    }
  };

  // Upload one or more files (from picker or paste) and append them to the previews.
  // Accepts images and common document types (txt, md, csv, doc/docx, xls/xlsx).
  const uploadFiles = useCallback(async (files, fallbackName) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(list.map(async (file) => {
        const namedFile = file.name
          ? file
          : new File([file], fallbackName || `adjunto-${Date.now()}.png`, { type: file.type || 'image/png' });
        const meta = describeFile(namedFile);
        const { file_url } = await base44.integrations.Core.UploadFile({ file: namedFile });
        return { url: file_url, name: namedFile.name, ...meta };
      }));
      setUploadPreviews(prev => [...prev, ...uploaded]);
    } catch {
      // silently fail — user can still type
    } finally {
      setUploading(false);
    }
  }, []);

  const removePreview = (url) => setUploadPreviews(prev => prev.filter(p => p.url !== url));

  // File upload from file picker (supports selecting multiple files at once)
  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    e.target.value = '';
    await uploadFiles(files);
  };

  // Paste handler — extract image(s) from clipboard
  const handlePaste = useCallback((e) => {
    if (disabled || uploading) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const images = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) images.push(file);
      }
    }
    if (images.length) {
      e.preventDefault();
      uploadFiles(images, `recibo-pegado-${Date.now()}.png`);
    }
  }, [disabled, uploading, uploadFiles]);

  // Global paste listener so users can paste anywhere on the Assistant page
  useEffect(() => {
    const onWindowPaste = (e) => {
      // Only act if there's an image — let normal text paste flow through textarea
      const items = e.clipboardData?.items;
      if (!items) return;
      let hasImage = false;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) { hasImage = true; break; }
      }
      if (hasImage) handlePaste(e);
    };
    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [handlePaste]);

  const sendWithAttachments = () => {
    if (!uploadPreviews.length) return;
    const urls = uploadPreviews.map(p => p.url);
    const base = input.trim();
    const onlyImages = uploadPreviews.every(p => p.kind === 'image');
    const prompt = base || (onlyImages
      ? 'Por favor analiza estos archivos y prepara el borrador del gasto.'
      : 'Por favor revisa estos archivos adjuntos.');
    // Embed each file URL inline in the content so the agent backend can fetch
    // the files (it parses URLs from message content). Also pass via file_urls.
    const attachmentLines = uploadPreviews
      .map(p => `[${p.label} adjunto: ${p.name} — ${p.url}]`)
      .join('\n');
    const msg = `${prompt}\n${attachmentLines}`;
    setInput('');
    setUploadPreviews([]);
    if (textareaRef.current) textareaRef.current.style.height = '46px';
    onSend(msg, urls);
  };

  const canSend = (input.trim() || uploadPreviews.length) && !disabled;

  return (
    <div className="flex-shrink-0 bg-background/95 backdrop-blur-sm border-t border-border">
      {/* Quick chips — contextual based on last assistant message */}
      {showChips && (
        <div className="pt-2 pb-1">
          <FiniaQuickChips
            onAction={(text) => onSend(text)}
            disabled={disabled}
            lastAssistantMessage={lastAssistantMessage}
          />
        </div>
      )}

      {/* Upload previews — supports multiple attachments */}
      <AnimatePresence>
        {uploadPreviews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-2 flex flex-col gap-1.5"
          >
            {uploadPreviews.map(p => (
              <div
                key={p.url}
                className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm flex-shrink-0">
                  {p.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.kind === 'image' ? 'Imagen lista para analizar' : `${p.label} listo para analizar`}
                  </p>
                </div>
                <button
                  onClick={() => removePreview(p.url)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice error */}
      <AnimatePresence>
        {voiceError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-2 flex items-center gap-2 bg-destructive/5 border border-destructive/20 rounded-xl px-3 py-2"
          >
            <p className="text-xs text-destructive font-medium flex-1">{voiceError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording indicator */}
      <AnimatePresence>
        {isRecording && (
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
            <p className="text-xs text-destructive font-medium">Grabando... habla ahora</p>
            <button onClick={stopVoice} className="ml-auto text-xs font-semibold text-destructive underline">
              Detener
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcribing indicator */}
      <AnimatePresence>
        {isTranscribing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-2 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2"
          >
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            <p className="text-xs text-primary font-medium">Transcribiendo audio…</p>
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
            title="Adjuntar imágenes o documentos (txt, md, csv, doc, xls)"
          >
            {uploading
              ? <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              : <Paperclip className="w-[18px] h-[18px]" />
            }
          </button>
          <input ref={fileInputRef} type="file" accept={ATTACHMENT_ACCEPT} multiple className="hidden" onChange={handleFileSelect} />
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => { setInput(e.target.value); adjustHeight(); }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled}
            placeholder="Escribe, habla o adjunta archivos…"
            className="w-full bg-muted/60 border border-border focus:border-primary/40 rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/15 resize-none leading-relaxed transition-all disabled:opacity-50"
            style={{ minHeight: '46px', maxHeight: '120px', overflowY: 'auto' }}
          />
        </div>

        {/* Right action buttons */}
        <div className="flex gap-1 flex-shrink-0 pb-1">
          {/* Voice — record audio and transcribe with Whisper */}
          {voiceSupported && (
            <button
              onClick={isRecording ? stopVoice : startVoice}
              disabled={disabled || isTranscribing}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 ${
                isRecording
                  ? 'bg-destructive text-white animate-pulse'
                  : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title={isRecording ? 'Detener grabación' : isTranscribing ? 'Transcribiendo…' : 'Grabar audio'}
            >
              {isTranscribing
                ? <Loader2 className="w-[18px] h-[18px] animate-spin" />
                : isRecording
                  ? <MicOff className="w-[18px] h-[18px]" />
                  : <Mic className="w-[18px] h-[18px]" />
              }
            </button>
          )}

          {/* Send */}
          {uploadPreviews.length ? (
            <button
              onClick={sendWithAttachments}
              disabled={!canSend}
              className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary text-primary-foreground disabled:opacity-40 transition-all active:scale-95 shadow-sm"
              title="Enviar con adjuntos"
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

      {/* Trust footer */}
      <div className="pb-1 flex items-center justify-center gap-3">
        <p className="text-[10px] text-muted-foreground/40 pb-1">
          🔒 Finia solo accede a los datos de tu familia
        </p>
      </div>
    </div>
  );
}