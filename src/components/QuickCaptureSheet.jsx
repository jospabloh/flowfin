import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MicOff, ArrowRight, Check, Loader2, ChevronRight } from 'lucide-react';
import { useFamily } from '@/lib/FamilyContext';
import { useCatalog } from '@/hooks/useCatalog';
import { useMemory } from '@/hooks/useMemory';
import { useCreateTransaction } from '@/hooks/useCreateTransaction';
import { matchCategory, parseVoiceText, getWeekNumber } from '@/lib/categoryMatcher';
import { todayISO } from '@/lib/formatters';
import { useUsageStats } from '@/lib/useUsageStats';
import { track } from '@/lib/analytics';
import confetti from 'canvas-confetti';

const LAST_PAYMENT_KEY = 'ff_quickcapture_last_payment';
const LAST_TYPE_KEY = 'ff_quickcapture_last_type';

function readLocal(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
  } catch {
    // ignore quota / disabled storage
  }
}

/**
 * Quick Capture — capture a transaction in <3s.
 *
 * Inputs reduced to: amount (required) + description (optional).
 * Everything else (category, person, payment method, date, required_type)
 * is inferred or carries over from last capture. Tap any chip to override.
 */
export default function QuickCaptureSheet({ open, onClose, onAdvancedMode }) {
  const { familyId, isReadOnly, defaultPersonId } = useFamily();
  const { categories, subcategories, persons, paymentMethods } = useCatalog(familyId);
  const { stats, increment } = useUsageStats();
  const { recordCapture, findAssociation } = useMemory();
  const createTransaction = useCreateTransaction({ onError: () => setSaving(false) });

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState(() => readLocal(LAST_TYPE_KEY, 'expense'));
  const [categoryIdOverride, setCategoryIdOverride] = useState('');
  const [personIdOverride, setPersonIdOverride] = useState('');
  const [paymentMethodIdOverride, setPaymentMethodIdOverride] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [chipPickerFor, setChipPickerFor] = useState(null); // 'category' | 'person' | 'payment' | null

  const amountRef = useRef(null);
  const recognitionRef = useRef(null);

  // Reset form whenever the sheet opens
  useEffect(() => {
    if (!open) return;
    setAmount('');
    setDescription('');
    setCategoryIdOverride('');
    setPersonIdOverride('');
    setPaymentMethodIdOverride('');
    setChipPickerFor(null);
    setSuccess(false);
    setSaving(false);
    track('quick_capture_open');
    const t = setTimeout(() => amountRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  // Persist type selection so users see their preferred toggle next time
  useEffect(() => {
    writeLocal(LAST_TYPE_KEY, type);
  }, [type]);

  // ── Inference ────────────────────────────────────────────────────────────
  const inferredCategoryId = useMemo(() => {
    const assoc = description.length >= 3 ? findAssociation(description) : null;
    if (assoc?.categoryId) return assoc.categoryId;
    if (description.length > 1) {
      const matches = matchCategory(description, subcategories, categories, stats, type);
      if (matches[0]?.category?.id) return matches[0].category.id;
    }
    const validCats = categories.filter(c => c.type === 'both' || c.type === type);
    return validCats[0]?.id || '';
  }, [description, subcategories, categories, stats, type, findAssociation]);

  const inferredPersonId = useMemo(() => {
    if (description.length >= 3) {
      const assoc = findAssociation(description);
      if (assoc?.personId) return assoc.personId;
    }
    if (defaultPersonId && persons.some(p => p.id === defaultPersonId)) return defaultPersonId;
    return persons[0]?.id || '';
  }, [description, persons, defaultPersonId, findAssociation]);

  const inferredPaymentMethodId = useMemo(() => {
    if (description.length >= 3) {
      const assoc = findAssociation(description);
      if (assoc?.paymentMethodId) return assoc.paymentMethodId;
    }
    const last = readLocal(LAST_PAYMENT_KEY, '');
    if (last && paymentMethods.some(m => m.id === last)) return last;
    return paymentMethods[0]?.id || '';
  }, [description, paymentMethods, findAssociation]);

  const categoryId = categoryIdOverride || inferredCategoryId;
  const personId = personIdOverride || inferredPersonId;
  const paymentMethodId = paymentMethodIdOverride || inferredPaymentMethodId;

  const selectedCategory = categories.find(c => c.id === categoryId);
  const selectedPerson = persons.find(p => p.id === personId);
  const selectedPayment = paymentMethods.find(m => m.id === paymentMethodId);

  // ── Voice ────────────────────────────────────────────────────────────────
  const startVoice = () => {
    const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = 'es-MX';
    r.continuous = false;
    r.interimResults = false;
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    r.onresult = (e) => {
      const text = e.results[0][0].transcript;
      const knownPersonNames = persons.map(p => p.name).filter(Boolean);
      const { amount: parsedAmount, description: parsedDesc, personHint, methodHint } = parseVoiceText(text, { knownPersonNames });
      if (parsedAmount) setAmount(String(parsedAmount));
      if (parsedDesc) setDescription(parsedDesc);
      if (personHint) {
        const match = persons.find(p => p.name?.toLowerCase() === personHint.toLowerCase());
        if (match) setPersonIdOverride(match.id);
      }
      if (methodHint) {
        const match = paymentMethods.find(m => {
          const n = (m.name || '').toLowerCase();
          return (methodHint === 'cash' && (n.includes('efectivo') || n.includes('cash')))
            || (methodHint === 'credit' && (n.includes('crédito') || n.includes('credito')))
            || (methodHint === 'debit' && (n.includes('débito') || n.includes('debito')))
            || (methodHint === 'transfer' && (n.includes('transfer')));
        });
        if (match) setPaymentMethodIdOverride(match.id);
      }
    };
    r.start();
    recognitionRef.current = r;
  };

  const stopVoice = () => { recognitionRef.current?.stop(); setIsListening(false); };

  // ── Save ─────────────────────────────────────────────────────────────────
  const canSave = !!amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && !!categoryId && !!personId && !saving && !isReadOnly;

  const handleSave = () => {
    if (!canSave) return;
    setSaving(true);
    const today = todayISO();
    const week = getWeekNumber(today);
    const payload = {
      date: today,
      type,
      amount: parseFloat(amount),
      description: description.trim(),
      family_id: familyId,
      category_id: categoryId || undefined,
      person_id: personId || undefined,
      payment_method_id: paymentMethodId || undefined,
      required_type: 'Necesario',
      has_invoice: false,
      week,
    };

    const prevAssoc = description.length >= 3 ? findAssociation(description) : null;

    createTransaction.mutate(payload, {
      onSuccess: () => {
        track('quick_capture_save', {
          type,
          had_description: Boolean(description.trim()),
          overrode_category: Boolean(categoryIdOverride),
          overrode_person: Boolean(personIdOverride),
          overrode_payment: Boolean(paymentMethodIdOverride),
          used_voice: false,
        });
        writeLocal(LAST_PAYMENT_KEY, paymentMethodId);
        recordCapture({
          description,
          categoryId,
          personId,
          paymentMethodId,
          type,
          previousSuggestion: prevAssoc ? {
            categoryId: prevAssoc.categoryId,
            personId: prevAssoc.personId,
            paymentMethodId: prevAssoc.paymentMethodId,
          } : undefined,
        });
        // Capture-side usage counter for subcategory ordering — none here since
        // QuickCapture intentionally skips subcategory choice; still increment
        // the inferred category so frequency stays in sync.
        if (categoryId) increment(categoryId);
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 }, colors: ['#059669', '#10B981', '#6EE7B7'] });
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose?.();
        }, 1000);
      },
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && canSave) {
      e.preventDefault();
      handleSave();
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Captura rápida"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="relative w-full sm:max-w-md bg-card text-foreground rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border max-h-[92vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-1 bg-muted rounded-full p-1">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${type === 'expense' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'}`}
                >Gasto</button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${type === 'income' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'}`}
                >Ingreso</button>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Amount */}
            <div className="px-6 pb-2">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Monto</label>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-muted-foreground">$</span>
                <input
                  ref={amountRef}
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
                  onKeyDown={handleKeyDown}
                  className="flex-1 min-w-0 text-5xl font-black bg-transparent outline-none placeholder-muted-foreground/40"
                />
                <button
                  type="button"
                  onClick={isListening ? stopVoice : startVoice}
                  aria-label={isListening ? 'Detener voz' : 'Iniciar voz'}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${isListening ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="px-6 pt-3 pb-2">
              <input
                type="text"
                placeholder="¿En qué? (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Inferred chips */}
            <div className="px-6 pt-2 pb-4 space-y-2">
              <Chip
                label="Categoría"
                value={selectedCategory?.name || 'Sin categoría'}
                icon={selectedCategory?.icon}
                onClick={() => setChipPickerFor(chipPickerFor === 'category' ? null : 'category')}
                emphasised={!categoryId}
              />
              <Chip
                label="Persona"
                value={selectedPerson?.name || 'Sin persona'}
                onClick={() => setChipPickerFor(chipPickerFor === 'person' ? null : 'person')}
                emphasised={!personId}
              />
              <Chip
                label="Método"
                value={selectedPayment?.name || 'Sin método'}
                onClick={() => setChipPickerFor(chipPickerFor === 'payment' ? null : 'payment')}
              />

              {chipPickerFor === 'category' && (
                <PickerList
                  options={categories.filter(c => c.type === 'both' || c.type === type).map(c => ({ id: c.id, label: c.name, icon: c.icon }))}
                  selectedId={categoryId}
                  onSelect={(id) => { setCategoryIdOverride(id); setChipPickerFor(null); }}
                />
              )}
              {chipPickerFor === 'person' && (
                <PickerList
                  options={persons.map(p => ({ id: p.id, label: p.name }))}
                  selectedId={personId}
                  onSelect={(id) => { setPersonIdOverride(id); setChipPickerFor(null); }}
                />
              )}
              {chipPickerFor === 'payment' && (
                <PickerList
                  options={paymentMethods.map(m => ({ id: m.id, label: m.name }))}
                  selectedId={paymentMethodId}
                  onSelect={(id) => { setPaymentMethodIdOverride(id); setChipPickerFor(null); }}
                />
              )}
            </div>

            {/* Save */}
            <div className="px-6 pb-5 space-y-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/30 disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {saving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : success
                    ? <Check className="w-4 h-4" />
                    : <ArrowRight className="w-4 h-4" />}
                {success ? 'Guardado' : saving ? 'Guardando…' : 'Guardar movimiento'}
              </button>
              <button
                type="button"
                onClick={() => { onClose?.(); onAdvancedMode?.(); }}
                className="w-full text-[11px] text-muted-foreground hover:text-foreground py-1"
              >
                Modo avanzado →
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Chip({ label, value, icon, onClick, emphasised }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border transition-colors ${emphasised ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/40 hover:bg-muted'}`}
    >
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="flex items-center gap-2 text-sm font-semibold truncate">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        <span className="truncate">{value}</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
      </span>
    </button>
  );
}

function PickerList({ options, selectedId, onSelect }) {
  if (!options.length) {
    return (
      <div className="text-xs text-muted-foreground px-4 py-2">
        No hay opciones todavía. Usa Modo avanzado para crear una.
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onSelect(opt.id)}
          className={`text-xs px-3 py-1.5 rounded-full border ${opt.id === selectedId ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-foreground border-border hover:bg-muted'}`}
        >
          {opt.icon ? <span className="mr-1" aria-hidden="true">{opt.icon}</span> : null}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
