import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { Mic, MicOff, Camera, Check, Receipt, AlertTriangle, Sparkles, BookOpen, Loader2 } from 'lucide-react';
import NativeSelect from '@/components/NativeSelect';
import UpgradePlansModal from '@/components/UpgradePlansModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useCatalog } from '@/hooks/useCatalog';
import { useFamily } from '@/lib/FamilyContext';
import { matchCategory, parseVoiceText, getWeekNumber } from '@/lib/categoryMatcher';
import { formatCurrency, todayISO } from '@/lib/formatters';
import { useUsageStats } from '@/lib/useUsageStats';
import { useMemory } from '@/hooks/useMemory';
import confetti from 'canvas-confetti';
import PersonAvatar from '@/components/PersonAvatar';
import PredictiveChips from '@/components/PredictiveChips';
import { usePermission, useCanView } from '@/lib/permissions/usePermission';

const REQUIRED_TYPES = ['Necesario', 'Gusto', 'Urgente', 'Inversión', 'Otro'];

export default function Capture() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { familyId, currency, currencySymbol, familyConfig, isReadOnly } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const fmtMXN = v => formatCurrency(v, { locale, currency });
  const { categories, subcategories, persons, paymentMethods } = useCatalog(familyId);
  const { stats, increment } = useUsageStats();
  const { recordCapture, findAssociation, syncFamilyRulesFromDB, getDescriptionCount } = useMemory();

  const { can_write: canUseAdvanced } = usePermission('capture.form.advanced');
  const canViewPredictiveChips = useCanView('capture.ai_assist.suggestions');

  const today = todayISO();

  const createTransactionMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });
    },
    onError: (err) => {
      toast({ title: 'Error al guardar', description: err?.message || 'No se pudo guardar el movimiento', variant: 'destructive' });
      setSaving(false);
    },
  });

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [personId, setPersonId] = useState('');
  const [date, setDate] = useState(today);
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [requiredType, setRequiredType] = useState('Necesario');
  const [hasInvoice, setHasInvoice] = useState(false);
  const [notes, setNotes] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [smartSuggestions, setSmartSuggestions] = useState({ suggestedCategories: [], suggestedPersons: [], suggestedPaymentMethods: [] });
  const [isListening, setIsListening] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { duplicates: [], pendingData: {} }
  const [loadingSmartSuggestions, setLoadingSmartSuggestions] = useState(false);
  const [atypicalWarning, setAtypicalWarning] = useState(null); // string | null
  const [autoSubcategoryHint, setAutoSubcategoryHint] = useState(null); // string | null (description)
  const [aiExtracting, setAiExtracting] = useState(false);

  const recognitionRef = useRef(null);
  const fileRef = useRef(null);

  // Sincronizar reglas familiares desde DB al montar
  useEffect(() => {
    if (familyId) syncFamilyRulesFromDB(familyConfig);
  }, [familyId]);

  // Fetch smart suggestions with debounce to avoid rate limiting
  useEffect(() => {
    if (description.length <= 2) {
      setSmartSuggestions({ suggestedCategories: [], suggestedPersons: [], suggestedPaymentMethods: [] });
      return;
    }
    const timer = setTimeout(() => {
      setLoadingSmartSuggestions(true);
      base44.functions.invoke('getSmartSuggestions', { familyId, description, type })
        .then(res => setSmartSuggestions(res.data || {}))
        .catch(() => setSmartSuggestions({ suggestedCategories: [], suggestedPersons: [], suggestedPaymentMethods: [] }))
        .finally(() => setLoadingSmartSuggestions(false));
    }, 800);
    return () => clearTimeout(timer);
  }, [description, familyId, type]);

  // F2.6 — Atypical amount warning: fires when amount changes and categoryStats are available
  useEffect(() => {
    const stats = smartSuggestions.categoryStats;
    if (!stats || stats.count < 5 || !amount) { setAtypicalWarning(null); return; }
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) { setAtypicalWarning(null); return; }
    const { mean, stddev } = stats;
    if (stddev > 0 && Math.abs(val - mean) > 2 * stddev) {
      setAtypicalWarning(`Normalmente gastas ${fmtMXN(mean)} en esta categoría.`);
    } else {
      setAtypicalWarning(null);
    }
  }, [amount, smartSuggestions.categoryStats]);

  const handleDescriptionChange = useCallback((val) => {
    setDescription(val);
    if (val.length > 1) {
      const matches = matchCategory(val, subcategories, categories, stats, type);
      setSuggestions(matches.slice(0, 4));

      if (val.length >= 3) {
        // Apply memorized association if no manual selection yet
        const assoc = findAssociation(val);
        if (assoc) {
          if (assoc.categoryId && !categoryId) setCategoryId(assoc.categoryId);
          if (assoc.subcategoryId && !subcategoryId) setSubcategoryId(assoc.subcategoryId);
          if (assoc.personId && !personId) setPersonId(assoc.personId);
          if (assoc.paymentMethodId && !paymentMethodId) setPaymentMethodId(assoc.paymentMethodId);
        }

        // F2.8 — Auto-subcategory hint: if description seen 3+ times without a subcategory
        const count = getDescriptionCount(val);
        const hasNoSubcategory = !assoc?.subcategoryId && !subcategoryId;
        if (count >= 3 && hasNoSubcategory && categoryId) {
          setAutoSubcategoryHint(val);
        } else {
          setAutoSubcategoryHint(null);
        }
      }
    } else {
      setSuggestions([]);
      setAutoSubcategoryHint(null);
    }
  }, [subcategories, categories, stats, findAssociation, getDescriptionCount, categoryId, subcategoryId, personId, paymentMethodId]);

  const applySuggestion = (s) => {
    setCategoryId(s.category?.id || '');
    setSubcategoryId(s.subcategory?.id || '');
    // Keep the user's typed description as-is
    setSuggestions([]);
  };

  const handleAddSubcategory = async (name) => {
    if (!categoryId) { toast({ title: 'Selecciona primero un Rubro', variant: 'destructive' }); return; }
    await base44.entities.Subcategory.create({
      name,
      family_id: familyId,
      category_id: categoryId,
      keywords: [name.toLowerCase()],
      usage_count: 0,
    });
    queryClient.invalidateQueries({ queryKey: ['subcategories'] });
    setSuggestions([]);
  };

  const handleAddCategory = async (name) => {
    const cat = await base44.entities.Category.create({
      name,
      family_id: familyId,
      icon: '📁',
      color: '#059669',
      type: 'both',
    });
    await queryClient.invalidateQueries({ queryKey: ['categories'] });
    setCategoryId(cat.id);
    setSuggestions([]);
  };

  // F3.5 — AI-powered field extraction from description (fallback when rule-based matching has low confidence)
  const handleAiExtract = async () => {
    if (!description || description.length < 5 || aiExtracting) return;
    setAiExtracting(true);
    try {
      // Create a temporary conversation in extraction mode (not shown to user)
      const conv = await base44.agents.createConversation({ agent_name: 'finance_assistant' });
      await base44.agents.addMessage(conv, {
        role: 'user',
        content: `[EXTRACT_FIELDS:] ${description}`,
      });
      // Wait for agent response (poll up to 4s)
      const deadline = Date.now() + 4000;
      let result = null;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 500));
        const updated = await base44.agents.getConversation(conv.id);
        const assistantMsg = (updated.messages || []).findLast(m => m.role === 'assistant');
        if (assistantMsg?.content) {
          try {
            result = JSON.parse(assistantMsg.content.replace(/```json\n?|```\n?/g, '').trim());
          } catch {}
          break;
        }
      }
      if (result && Object.keys(result).length > 0) {
        if (result.categoryId) setCategoryId(result.categoryId);
        if (result.subcategoryId) setSubcategoryId(result.subcategoryId);
        if (result.personId) setPersonId(result.personId);
        if (result.paymentMethodId) setPaymentMethodId(result.paymentMethodId);
        if (result.amount) setAmount(String(result.amount));
        if (result.date) setDate(result.date);
      }
    } catch {
      // Silent fail — form stays as-is
    } finally {
      setAiExtracting(false);
    }
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast({ title: 'Tu navegador no soporta reconocimiento de voz', variant: 'destructive' }); return; }
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
      const { amount: parsedAmount, description: parsedDesc, date: parsedDate, methodHint, personHint } = parseVoiceText(text, { knownPersonNames });
      if (parsedAmount) setAmount(String(parsedAmount));
      if (parsedDate) setDate(parsedDate);
      if (personHint) {
        const match = persons.find(p => p.name?.toLowerCase() === personHint.toLowerCase());
        if (match) setPersonId(match.id);
      }
      if (methodHint) {
        const match = paymentMethods.find(m => {
          const n = (m.name || '').toLowerCase();
          return (methodHint === 'cash' && (n.includes('efectivo') || n.includes('cash')))
            || (methodHint === 'credit' && (n.includes('crédito') || n.includes('credito')))
            || (methodHint === 'debit' && (n.includes('débito') || n.includes('debito')))
            || (methodHint === 'transfer' && (n.includes('transfer')));
        });
        if (match) setPaymentMethodId(match.id);
      }
      handleDescriptionChange(parsedDesc || text);
    };
    r.start();
    recognitionRef.current = r;
  };

  const stopVoice = () => { recognitionRef.current?.stop(); setIsListening(false); };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setReceiptImage(url);
    if (!description) handleDescriptionChange(`Ticket ${today}`);
  };

  const doSave = (txData) => {
    setDuplicateWarning(null);
    // Capture what the auto-suggestion was before saving (for F2.7 negative signal)
    const prevAssoc = findAssociation(description);
    createTransactionMutation.mutate(txData, {
      onSuccess: () => {
        if (subcategoryId) increment(subcategoryId);
        // Learn this capture, including previous suggestion for correction signal
        recordCapture({
          description, categoryId, subcategoryId, personId, paymentMethodId, type,
          previousSuggestion: prevAssoc ? {
            categoryId: prevAssoc.categoryId,
            personId: prevAssoc.personId,
            paymentMethodId: prevAssoc.paymentMethodId,
          } : undefined,
        });
        setSaving(false);
        setShowSuccess(true);
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ['#059669','#10B981','#6EE7B7'] });
        setTimeout(() => {
          setShowSuccess(false);
          setAmount(''); setDescription(''); setCategoryId(''); setSubcategoryId('');
          setNotes(''); setReceiptImage(null); setSuggestions([]);
        }, 1500);
      },
    });
  };

  const validCategories = categories.filter(c => c.type === 'both' || c.type === type);
  const missingCategories = validCategories.length === 0;
  const missingPersons = persons.length === 0;

  const handleSave = async () => {
    if (isReadOnly) { setShowUpgrade(true); return; }
    if (!amount || isNaN(parseFloat(amount))) return;
    if (!categoryId) return;
    if (!personId) return;
    setSaving(true);
    const week = getWeekNumber(date);
    const txData = {
      date, type, amount: parseFloat(amount), description,
      family_id: familyId,
      category_id: categoryId || undefined,
      subcategory_id: subcategoryId || undefined,
      person_id: personId || undefined,
      payment_method_id: paymentMethodId || undefined,
      required_type: requiredType, has_invoice: hasInvoice, notes, week,
    };

    // Check for duplicates — wrapped in try/catch so a network error never leaves saving=true
    try {
      const existingOnDate = await base44.entities.Transaction.filter({
        family_id: familyId,
        date,
        type,
      });

      const inputAmount = parseFloat(amount);
      const descB = (description || '').toLowerCase().trim();

      const duplicates = existingOnDate.filter(t => {
        const sameAmount = Math.abs(t.amount - inputAmount) / Math.max(inputAmount, 1) < 0.05;
        const descA = (t.description || '').toLowerCase().trim();

        // Same description (fuzzy): either one contains the other or they're equal
        const sameDesc = descA.length > 1 && descB.length > 1 && (
          descA === descB ||
          descA.includes(descB) ||
          descB.includes(descA)
        );

        // Same category OR same description — if amount matches and either condition, flag it
        const sameCat = categoryId && t.category_id === categoryId;

        return sameAmount && (sameCat || sameDesc);
      });

      if (duplicates.length > 0) {
        setSaving(false);
        setDuplicateWarning({ duplicates, pendingData: txData });
        return;
      }
    } catch {
      // If duplicate check fails, just proceed to save normally
    }

    doSave(txData);
  };

  const selectedCategory = categories.find(c => c.id === categoryId);
  const selectedSubcategory = subcategories.find(s => s.id === subcategoryId);
  const selectedPerson = persons.find(p => p.id === personId);
  const selectedMethod = paymentMethods.find(m => m.id === paymentMethodId);

  return (
   <div data-tutorial="capture-form-card" className="min-h-screen pb-4 overscroll-none" onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}>
      {/* Read-only mode banner */}
      {isReadOnly && (
        <div className="mx-4 mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Modo solo lectura activo</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Tu período de prueba ha terminado. Activa una licencia para continuar registrando movimientos.</p>
          </div>
          <button onClick={() => setShowUpgrade(true)}
            className="flex-shrink-0 px-2.5 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-colors">
            Activar
          </button>
        </div>
      )}
      {/* Setup missing warning */}
      {(missingCategories || missingPersons) && (
        <div className="mx-4 mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Configura antes de guardar</p>
              <div className="text-xs text-amber-600 dark:text-amber-500 mt-1 space-y-0.5">
                {missingPersons && <p>• No tienes personas registradas</p>}
                {missingCategories && <p>• No tienes rubros para {type === 'expense' ? 'egresos' : 'ingresos'}</p>}
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/Catalogs')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold w-full justify-center hover:bg-amber-600 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Ir a Catálogos
          </button>
        </div>
      )}

      {/* F2.1 — Predictive chips */}
      {canViewPredictiveChips && (
        <PredictiveChips
          familyId={familyId}
          onSelect={chip => {
            if (chip.amount) setAmount(String(chip.amount));
            if (chip.label) setDescription(chip.label);
            if (chip.categoryId) setCategoryId(chip.categoryId);
            if (chip.subcategoryId) setSubcategoryId(chip.subcategoryId);
            if (chip.personId) setPersonId(chip.personId);
            if (chip.paymentMethodId) setPaymentMethodId(chip.paymentMethodId);
          }}
        />
      )}

      {/* Type toggle */}
      <div className="flex mx-4 mt-4 rounded-2xl bg-muted p-1 gap-1">
        {[{ key: 'expense', label: '💸 Egreso' }, { key: 'income', label: '💰 Ingreso' }].map(t => (
          <button key={t.key} onClick={() => setType(t.key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all touch-target
              ${type === t.key ? (t.key === 'expense' ? 'bg-expense text-white shadow-sm' : 'bg-income text-white shadow-sm') : 'text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="px-4 mt-4">
        <div className={`rounded-2xl border-2 transition-colors p-4 ${type === 'expense' ? 'border-expense/30 bg-expense/5' : 'border-income/30 bg-income/5'}`}>
          <p className="text-xs text-muted-foreground mb-1">Monto ({currency})</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-light text-muted-foreground">{currencySymbol}</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" inputMode="decimal"
              className="flex-1 text-4xl font-black bg-transparent border-none outline-none text-foreground placeholder-muted-foreground/30" />
          </div>
        </div>
      </div>

      {/* F2.6 — Atypical amount warning */}
      {atypicalWarning && (
        <div className="px-4 mt-1">
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            {atypicalWarning} ¿Continuar?
          </p>
        </div>
      )}

      {/* Description + voice/camera */}
      <div className="px-4 mt-3">
        <div className="relative">
          <input type="text" value={description} onChange={e => handleDescriptionChange(e.target.value)}
            placeholder={type === 'expense' ? '¿En qué gastaste? (gasolina, mandado...)' : '¿De dónde viene? (sueldo, renta...)'}
            className={`w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 ${description.length > 10 && !categoryId ? 'pr-32' : 'pr-24'}`} />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            {/* F3.5 — AI extraction button: visible when description is long and category is not yet matched */}
            {description.length > 10 && !categoryId && (
              <button onClick={handleAiExtract} disabled={aiExtracting} aria-label="Entender con IA"
                className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all touch-target disabled:opacity-60">
                {aiExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </button>
            )}
            <button onClick={isListening ? stopVoice : startVoice}
              className={`p-2 rounded-lg transition-all touch-target ${isListening ? 'bg-expense text-white animate-pulse-ring' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button onClick={() => fileRef.current?.click()} className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground touch-target">
              <Camera className="w-4 h-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          </div>
        </div>

        {/* Smart suggestions */}
        <AnimatePresence>
          {(suggestions.length > 0 || (description.length > 2 && suggestions.length === 0 && !categoryId)) && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="mt-1 flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => applySuggestion(s)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent text-accent-foreground border border-border hover:bg-primary hover:text-primary-foreground transition-colors">
                  <span style={{ backgroundColor: s.category?.color || '#059669' }} className="w-2 h-2 rounded-full flex-shrink-0" />
                  {s.category?.name} › {s.subcategory?.name}
                </button>
              ))}
              {description.length > 2 && suggestions.length === 0 && !categoryId && (
                <button onClick={() => handleAddCategory(description)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-dashed border-border hover:bg-primary/10 hover:text-primary transition-colors">
                  ＋ Crear rubro "{description}"
                </button>
              )}
              {description.length > 2 && categoryId && subcategories.filter(s => s.category_id === categoryId).length > 0 &&
               !subcategories.find(s => s.category_id === categoryId && s.name.toLowerCase().includes(description.toLowerCase())) && (
                <button onClick={() => handleAddSubcategory(description)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-dashed border-border hover:bg-primary/10 hover:text-primary transition-colors">
                  ＋ Agregar subrubro "{description}"
                </button>
              )}
              {/* F2.8 — Auto-subcategory proactive hint */}
              {autoSubcategoryHint && (
                <button onClick={() => handleAddSubcategory(autoSubcategoryHint)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
                  ✨ Guardar "{autoSubcategoryHint}" como subrubro
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Receipt preview */}
      {receiptImage && (
        <div className="px-4 mt-2">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
            <img src={receiptImage} alt="ticket" className="w-full h-full object-cover" />
            <button onClick={() => setReceiptImage(null)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px]">✕</button>
          </div>
        </div>
      )}

      {/* Smart suggestions for categories */}
      {smartSuggestions.suggestedCategories.length > 0 && (
        <div className="px-4 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs font-semibold text-foreground">Rubros frecuentes</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {smartSuggestions.suggestedCategories.map((cat, i) => (
              <button
                key={i}
                onClick={() => { setCategoryId(cat.id); setSubcategoryId(''); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category + Subcategory */}
      <div className={`grid gap-2 px-4 mt-3 ${type === 'expense' && canUseAdvanced ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        <NativeSelect
          value={categoryId}
          onChange={e => { setCategoryId(e.target.value); setSubcategoryId(''); }}
          placeholder="Rubro"
          options={validCategories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
          className={`bg-card border rounded-xl px-3 py-2.5 text-sm w-full ${!categoryId ? 'border-expense/60 bg-expense/5' : 'border-border'}`}
        />
        {type === 'expense' && canUseAdvanced && (
          <NativeSelect
            value={subcategoryId}
            onChange={e => setSubcategoryId(e.target.value)}
            placeholder="SubRubro"
            options={subcategories.filter(s => s.category_id === categoryId).map(s => ({ value: s.id, label: s.name }))}
            className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm w-full"
          />
        )}
      </div>

      {/* Smart suggestions for persons */}
      {smartSuggestions.suggestedPersons.length > 0 && (
        <div className="px-4 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs font-semibold text-foreground">Personas frecuentes</p>
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {smartSuggestions.suggestedPersons.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setPersonId(p.id);
                  // F2.4 — auto-select preferred payment method for this person
                  if (p.preferredMethodId && !paymentMethodId) setPaymentMethodId(p.preferredMethodId);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <PersonAvatar person={p} size="xs" />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Person selector */}
      {persons.length > 0 && (
        <div className="flex gap-2 px-4 mt-3 overflow-x-auto hide-scrollbar">
          <button onClick={() => setPersonId('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap
              ${!personId ? 'bg-expense/10 text-expense border-expense/40' : 'border-border text-muted-foreground'}`}>
            Sin persona ⚠️
          </button>
          {persons.map(p => (
            <button key={p.id} onClick={() => {
              setPersonId(p.id);
              // F2.4 — if no method chosen and person has a preferred method from smart suggestions, apply it
              if (!paymentMethodId) {
                const suggested = smartSuggestions.suggestedPersons?.find(sp => sp.id === p.id);
                if (suggested?.preferredMethodId) setPaymentMethodId(suggested.preferredMethodId);
              }
            }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap
                ${personId === p.id ? 'text-white border-transparent' : 'border-border text-muted-foreground'}`}
              style={personId === p.id ? { backgroundColor: p.color, borderColor: p.color } : {}}>
              <PersonAvatar person={p} size="xs" />
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Smart suggestions for payment methods */}
      {smartSuggestions.suggestedPaymentMethods.length > 0 && (
        <div className="px-4 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs font-semibold text-foreground">Formas de pago frecuentes</p>
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {smartSuggestions.suggestedPaymentMethods.map(m => (
              <button
                key={m.id}
                onClick={() => setPaymentMethodId(paymentMethodId === m.id ? '' : m.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all ${
                  paymentMethodId === m.id
                    ? 'bg-secondary text-secondary-foreground border-secondary'
                    : 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payment method */}
      {paymentMethods.length > 0 && (
        <div className="flex gap-2 px-4 mt-2 overflow-x-auto hide-scrollbar">
          {paymentMethods.map(m => (
            <button key={m.id} onClick={() => setPaymentMethodId(paymentMethodId === m.id ? '' : m.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap
                ${paymentMethodId === m.id ? 'bg-secondary text-secondary-foreground border-secondary' : 'border-border text-muted-foreground'}`}>
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Date + Required (expense only) */}
      <div className={`grid gap-2 px-4 mt-3 ${type === 'expense' && canUseAdvanced ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="relative">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          {date !== today && (
            <span className="absolute -top-2 left-3 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
              {date < today.slice(0, 7) ? 'Mes anterior' : 'Fecha pasada'}
            </span>
          )}
        </div>
        {type === 'expense' && canUseAdvanced && (
          <NativeSelect
            value={requiredType}
            onChange={e => setRequiredType(e.target.value)}
            placeholder="Clasificación"
            options={REQUIRED_TYPES.map(r => ({ value: r, label: r }))}
            className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm w-full"
          />
        )}
      </div>

      {/* Invoice toggle (expense only, advanced) */}
      {type === 'expense' && canUseAdvanced && (
        <div className="px-4 mt-2">
          <button onClick={() => setHasInvoice(!hasInvoice)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all
              ${hasInvoice ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground'}`}>
            <Receipt className="w-3.5 h-3.5" />
            Con factura
          </button>
        </div>
      )}

      {/* Notes (advanced) */}
      {canUseAdvanced && (
        <div className="px-4 mt-2">
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
            className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      )}

      {/* Save button */}
      <div className="px-4 mt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        {isReadOnly ? (
          <button onClick={() => setShowUpgrade(true)}
            className="w-full py-4 rounded-2xl bg-amber-500 text-white font-bold text-base shadow-lg active:scale-[0.98] transition-all touch-target">
            🔓 Activar licencia para guardar
          </button>
        ) : (
          <button onClick={handleSave} disabled={!amount || !categoryId || !personId || saving}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all touch-target">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        )}
      </div>

      {/* Duplicate warning modal */}
      <AnimatePresence>
        {duplicateWarning && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
              onClick={() => setDuplicateWarning(null)} />
            <motion.div
              initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border p-5"
              style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 16px)' }}
            >
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">¿Movimiento duplicado?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ya existe{duplicateWarning.duplicates.length > 1 ? `n ${duplicateWarning.duplicates.length} movimientos similares` : ' un movimiento similar'} en esta fecha con monto o rubro parecido:
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-5 max-h-40 overflow-y-auto">
                {duplicateWarning.duplicates.map(d => {
                  const cat = categories.find(c => c.id === d.category_id);
                  return (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2 bg-muted rounded-xl text-xs">
                      <span className="text-foreground font-medium truncate max-w-[60%]">
                        {d.description || cat?.name || '—'}
                      </span>
                      <span className={`font-bold ${d.type === 'expense' ? 'text-expense' : 'text-income'}`}>
                        {d.type === 'expense' ? '-' : '+'}{formatCurrency(d.amount, { locale, currency })}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setDuplicateWarning(null)}
                  className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => doSave(duplicateWarning.pendingData)}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm active:scale-[0.98] transition-all"
                >
                  Guardar de todos modos
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <UpgradePlansModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />

      {/* Success overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              className="w-24 h-24 rounded-full bg-income flex items-center justify-center shadow-2xl">
              <Check className="w-12 h-12 text-white" strokeWidth={3} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}