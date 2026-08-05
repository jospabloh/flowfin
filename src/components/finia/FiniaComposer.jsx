import { useRef, useState, useCallback, useEffect } from 'react';
import { Send, Mic, MicOff, Paperclip, X, Loader2, Camera, Image, FileText, ClipboardPaste } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import FiniaQuickChips from './FiniaQuickChips';

// Two separate file inputs (Fotos / Archivos) instead of one combined
// picker — confirmed via a screen recording of the actual failure, not
// guessed. On Android, tapping the paperclip used to open one input whose
// `accept` mixed `image/*` with document extensions; the OS routed that
// through the phone's general-purpose "Files" app. That app's "Archivos
// recientes" shortcut list opens a tapped item with "Abrir con" (open-with)
// instead of returning it to the page — the picker visibly "succeeds" but
// our onChange handler never fires, so nothing gets attached and there's no
// error to show (nothing in our own code ran). The dedicated Photos picker
// that phones offer as its own option doesn't have that bug — it always
// returns the selection. Splitting into Cámara / Fotos / Archivos (the same
// three-way split most chat apps use) routes the common case — attaching a
// photo — through the picker that actually works, and keeps "Archivos" for
// the document types that have no Photos-picker equivalent anyway.
// `.heic`/`.heif` stay explicit alongside `image/*` as a second, MIME-
// independent match for iPhone photos, whose reported MIME type isn't
// always reliable either.
const IMAGE_ACCEPT = 'image/*,.heic,.heif';
const DOCUMENT_ACCEPT = '.txt,.md,.csv,.doc,.docx,.xls,.xlsx';
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'];

// Confirmed via a second screen recording: even a *successful* native
// picker round-trip (checkbox multi-select in "Mis archivos", "Aceptar" on
// a fresh camera shot) still lands back on Finia's untouched welcome
// screen — no preview, no error, nothing. That's not the "Abrir con"
// picker bug from before; a genuinely completed selection can't hit that.
// The only thing that explains total silence after a *working* picker
// round-trip is the page itself getting re-created while the Cámara/
// Galería app was in the foreground (Samsung Internet — and Android
// browsers generally, under memory pressure — can reload or replace the
// backgrounded tab instead of keeping it alive). If that happens, the
// picked file arrives at a fresh FiniaComposer instance's `<input>` that
// was never told to expect it, or doesn't arrive at all — either way
// there's nothing left in memory that could show an upload error, because
// the code that would have shown one no longer exists.
//
// We can't stop the browser from doing this, but we can make it visible
// instead of silent: right before opening any picker we drop a timestamped
// flag (+ the draft text) into sessionStorage, which — unlike React state —
// survives a reload. A `visibilitychange` listener clears that flag the
// moment this same JS instance is still alive to see the tab come back to
// the foreground, whether the user picked a file or cancelled. So if the
// flag is still there on the next mount, this can't be that page's first
// visit — it's the *same tab* coming back from a reload we didn't ask for,
// and there's no scenario left in which the flag survives that isn't one.
const PENDING_ATTACH_KEY = 'finia-composer-pending-attach';
const DRAFT_KEY = 'finia-composer-draft';
const PENDING_ATTACH_MAX_AGE_MS = 5 * 60 * 1000; // ignore a flag left over from an abandoned tab

function clearPendingAttach() {
  try {
    sessionStorage.removeItem(PENDING_ATTACH_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
  } catch { /* sessionStorage unavailable (private mode, etc.) — non-fatal */ }
}

// Categorize a file into a kind/label/emoji for the preview UI and message text.
function describeFile(file) {
  const name = file?.name || '';
  const type = file?.type || '';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  // Fall back to the extension when `type` is empty/generic — the same
  // unreliable-MIME phones/pickers described above also mislabel a real
  // image as a plain "Archivo" here once it does get attached.
  if (type.startsWith('image/') || IMAGE_EXTENSIONS.includes(ext)) return { kind: 'image', label: 'Imagen', emoji: '🧾' };
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
  const [uploadError, setUploadError] = useState(null);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [reloadNotice, setReloadNotice] = useState(false);
  const lastEnterWasNewLine = useRef(false);
  const textareaRef = useRef(null);
  const cameraInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const docInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // Runs once per real mount. If a pending-attach flag from a previous
  // instance of this component is still in sessionStorage, this can't be
  // this tab's first visit — see the constants above for why that only
  // happens when the browser re-created the page out from under a picker.
  // Recover the draft text and say what happened instead of staying silent.
  useEffect(() => {
    let pendingRaw = null;
    try { pendingRaw = sessionStorage.getItem(PENDING_ATTACH_KEY); } catch { /* ignore */ }
    if (pendingRaw) {
      const age = Date.now() - Number(pendingRaw);
      if (Number.isFinite(age) && age >= 0 && age < PENDING_ATTACH_MAX_AGE_MS) {
        setReloadNotice(true);
        let draft = null;
        try { draft = sessionStorage.getItem(DRAFT_KEY); } catch { /* ignore */ }
        if (draft) setInput(draft);
      }
      clearPendingAttach();
    }
  }, []);

  // If this same JS instance is still alive to see the tab come back to
  // the foreground, no reload happened — clear the flag immediately so a
  // later, unrelated mount never misreads it as one. Covers cancelling the
  // picker too (onChange may never fire in that case).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') clearPendingAttach();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Unified submit: sends with or without attachments depending on state.
  const handleSubmit = useCallback((rawText) => {
    if (disabled) return;
    const msg = rawText?.trim() ?? input.trim();
    if (!msg && !uploadPreviews.length) return;

    if (uploadPreviews.length) {
      const urls = uploadPreviews.map(p => p.url);
      const onlyImages = uploadPreviews.every(p => p.kind === 'image');
      const prompt = msg || (onlyImages
        ? 'Por favor analiza estos archivos y prepara el borrador del gasto.'
        : 'Por favor revisa estos archivos adjuntos.');
      const attachmentLines = uploadPreviews
        .map(p => `[${p.label} adjunto: ${p.name} — ${p.url}]`)
        .join('\n');
      const fullMsg = `${prompt}\n${attachmentLines}`;
      setInput('');
      setUploadPreviews([]);
      if (textareaRef.current) textareaRef.current.style.height = '46px';
      onSend(fullMsg, urls);
    } else {
      if (!msg) return;
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = '46px';
      onSend(msg);
    }
  }, [input, uploadPreviews, disabled, onSend]);

  // 1st Enter → new line, 2nd consecutive Enter → send
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (lastEnterWasNewLine.current) {
        lastEnterWasNewLine.current = false;
        const trimmed = input.replace(/\n$/, '');
        handleSubmit(trimmed);
      } else {
        lastEnterWasNewLine.current = true;
        setInput(prev => prev + '\n');
        setTimeout(adjustHeight, 0);
      }
    } else {
      lastEnterWasNewLine.current = false;
    }
  }, [input, handleSubmit]);

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
      setUploadError('No se pudo subir el archivo. Intenta de nuevo.');
      setTimeout(() => setUploadError(null), 3500);
    } finally {
      setUploading(false);
    }
  }, []);

  const removePreview = (url) => setUploadPreviews(prev => prev.filter(p => p.url !== url));

  // Opens one of the three dedicated pickers (Cámara / Fotos / Archivos).
  // Called synchronously from the sheet's onClick so the .click() still
  // counts as a direct response to the user's tap — required for the file
  // picker to open on iOS Safari. Drops the pending-attach flag (+ draft)
  // right before handing off to the OS — see the constants above.
  const openPicker = (ref) => {
    setShowAttachSheet(false);
    try {
      sessionStorage.setItem(PENDING_ATTACH_KEY, String(Date.now()));
      if (input.trim()) sessionStorage.setItem(DRAFT_KEY, input);
    } catch { /* sessionStorage unavailable — the OS picker still opens fine */ }
    ref.current?.click();
  };

  // Pegar — reads an image straight from the clipboard via the async
  // Clipboard API, bypassing <input type=file> and its native OS picker
  // entirely. Confirmed via three separate screen recordings that on this
  // phone's Samsung Internet, going through the native picker — Cámara,
  // Fotos, or Archivos, in a real tab or a bookmarked shortcut, cancelled
  // or genuinely completed with a confirmed selection — can silently never
  // deliver the file to this page's <input>, with nothing left in our own
  // code to catch or explain it: a bug in Samsung Internet's own bridging
  // between its picker UI and the page, outside what any accept/capture
  // tuning on our end can reach. This sidesteps that layer altogether:
  // copy the photo in Galería (long-press → Copiar), then tap this button.
  const pasteFromClipboard = async () => {
    setShowAttachSheet(false);
    if (!navigator.clipboard?.read) {
      setUploadError('Tu navegador no soporta este botón — mantén presionado el cuadro de texto y elegí "Pegar".');
      setTimeout(() => setUploadError(null), 4500);
      return;
    }
    try {
      const clipboardItems = await navigator.clipboard.read();
      const images = [];
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) images.push(await item.getType(imageType));
      }
      if (images.length) {
        await uploadFiles(images, `pegado-${Date.now()}.png`);
      } else {
        setUploadError('No hay ninguna imagen copiada. Copiá una foto desde tu galería primero.');
        setTimeout(() => setUploadError(null), 4500);
      }
    } catch {
      setUploadError('No se pudo leer el portapapeles. Probá mantener presionado el cuadro de texto y "Pegar".');
      setTimeout(() => setUploadError(null), 4500);
    }
  };

  // File upload from file picker (supports selecting multiple files at once)
  const handleFileSelect = async (e) => {
    // Reaching this line at all proves this instance survived — clear the
    // flag regardless of whether a file actually came back.
    clearPendingAttach();
    const files = e.target.files;
    if (!files?.length) return;
    e.target.value = '';
    await uploadFiles(files);
  };

  // Paste handler — extract image(s) from clipboard. Wired ONLY through the
  // window-level listener below (paste events bubble up from the textarea
  // to window), never also as the textarea's own onPaste — attaching both
  // fired this same handler twice for one physical paste and silently
  // double-uploaded the pasted image.
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

      {/* Upload error */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-2 flex items-center gap-2 bg-destructive/5 border border-destructive/20 rounded-xl px-3 py-2"
          >
            <p className="text-xs text-destructive font-medium flex-1">{uploadError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reload notice — shown when the page comes back from Cámara/Fotos
          having lost the in-flight attachment (see PENDING_ATTACH_KEY) */}
      <AnimatePresence>
        {reloadNotice && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-2 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2"
          >
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex-1">
              El navegador cerró Finia al abrir la cámara/galería y el adjunto se perdió. Tu mensaje se recuperó — probá adjuntar de nuevo.
            </p>
            <button
              onClick={() => setReloadNotice(false)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
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
            onClick={() => setShowAttachSheet(true)}
            disabled={disabled || uploading}
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground hover:bg-accent transition-all active:scale-95 disabled:opacity-40"
            title="Adjuntar imágenes o documentos"
          >
            {uploading
              ? <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              : <Paperclip className="w-[18px] h-[18px]" />
            }
          </button>
          {/* Camera — `capture="environment"` asks the browser to hand the
              shot directly back to this input via its own capture contract,
              instead of Samsung's own ambiguous "Cámara" resolver shortcut
              (which the old single combined input relied on implicitly). */}
          <input ref={cameraInputRef} type="file" accept={IMAGE_ACCEPT} capture="environment" className="hidden" onChange={handleFileSelect} />
          {/* Fotos — plain image accept, no capture. On some browsers this
              reaches a dedicated Photos picker that bypasses the general
              Files app's bugs; confirmed via screen recording that on this
              Samsung Internet version it does not — it still opens
              Samsung's own "Seleccionar una acción" resolver, whose result
              can fail to reach this input at all (see pasteFromClipboard
              below for the reliable fallback). Kept because it's still the
              standards-correct way to ask for "an image, not a capture",
              and may behave better on other devices/browsers. */}
          <input ref={photoInputRef} type="file" accept={IMAGE_ACCEPT} multiple className="hidden" onChange={handleFileSelect} />
          {/* Archivos — documents only, kept separate from image/* so this
              is the only path that still goes through the general Files
              app (which has no better alternative for these formats). */}
          <input ref={docInputRef} type="file" accept={DOCUMENT_ACCEPT} multiple className="hidden" onChange={handleFileSelect} />
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
          <button
            onClick={() => handleSubmit()}
            disabled={!canSend}
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary text-primary-foreground disabled:opacity-40 transition-all active:scale-95 shadow-sm hover:bg-primary/90"
            title={uploadPreviews.length ? 'Enviar con adjuntos' : 'Enviar'}
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {/* Trust footer */}
      <div className="pb-1 flex items-center justify-center gap-3">
        <p className="text-[10px] text-muted-foreground/40 pb-1">
          🔒 Finia solo accede a los datos de tu familia
        </p>
      </div>

      {/* Attach sheet — Cámara / Fotos / Archivos as three distinct pickers */}
      <AnimatePresence>
        {showAttachSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
              onClick={() => setShowAttachSheet(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border p-5"
              style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-foreground">Adjuntar</p>
                <button
                  onClick={() => setShowAttachSheet(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => openPicker(cameraInputRef)}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-border hover:bg-muted active:scale-[0.97] transition-all"
                >
                  <Camera className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Cámara</span>
                </button>
                <button
                  onClick={() => openPicker(photoInputRef)}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-border hover:bg-muted active:scale-[0.97] transition-all"
                >
                  <Image className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Fotos</span>
                </button>
                <button
                  onClick={() => openPicker(docInputRef)}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-border hover:bg-muted active:scale-[0.97] transition-all"
                >
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Archivos</span>
                </button>
                <button
                  onClick={pasteFromClipboard}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 active:scale-[0.97] transition-all"
                >
                  <ClipboardPaste className="w-5 h-5 text-primary" />
                  <span className="text-xs font-medium text-primary">Pegar</span>
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-3">
                ¿Cámara, Fotos o Archivos no funcionan? Mantén presionada la foto en tu galería, tocá <strong>Copiar</strong> y después <strong>Pegar</strong> acá arriba.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}