import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { guardedCreate } from '@/lib/guardedWrite';
import { useCreateTransaction } from '@/hooks/useCreateTransaction';
import { Mic, MicOff, Camera, Check, Receipt, AlertTriangle, Sparkles, BookOpen, Loader2, Plane, X, Users, CalendarDays, Calculator } from 'lucide-react';
import CalculatorWidget from '@/components/CalculatorWidget';
import { Switch } from '@/components/ui/switch';
import { Alert } from '@/components/ui/alert';
import { getExchangeRate } from '@/services/exchangeRateService';
import { computeTripSpent } from '@/lib/tripBudget';
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
import { z } from 'zod';

// The AI field-extraction call returns free-form JSON. Validate each field
// independently before it touches the form so a malformed/hostile value (e.g.
// amount: "abc", an object where a string is expected) can never populate the
// transaction. `.catch(undefined)` drops only the bad field, keeping the rest.
const optionalId = z.string().min(1).max(64).optional().catch(undefined);
const aiExtractSchema = z.object({
  categoryId: optionalId,
  subcategoryId: optionalId,
  personId: optionalId,
  paymentMethodId: optionalId,
  amount: z.coerce.number().positive().finite().optional().catch(undefined),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
}).passthrough();

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

  const createTransactionMutation = useCreateTransaction({
    onError: () => setSaving(false),
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
  const [creditCardBalance, setCreditCardBalance] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [smartSuggestions, setSmartSuggestions] = useState({ suggestedCategories: [], suggestedPersons: [], suggestedPaymentMethods: [] });
  const [showCalculator, setShowCalculator] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { duplicates: [], pendingData: {} }
  const [atypicalWarning, setAtypicalWarning] = useState(null); // string | null
  const [autoSubcategoryHint, setAutoSubcategoryHint] = useState(null); // string | null (description)
  const [aiExtracting, setAiExtracting] = useState(false);

  // Trip linking state
  const [activeTrips, setActiveTrips] = useState([]);
  const [tripId, setTripId] = useState('');
  const [tripDismissed, setTripDismissed] = useState(false);
  const [originalCurrency, setOriginalCurrency] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  // Split state (trip-only, always an even split — see is_split/split_with_person_ids on Transaction)
  const [isSplit, setIsSplit] = useState(false);
  const [splitWithPersonIds, setSplitWithPersonIds] = useState([]);

  // Shared-expense state — one purchase, paid unevenly by 2+ family members
  // (any transaction, not trip-only). Saves as N separate Transaction rows
  // sharing a split_group_id, each with its own real amount/person_id — see
  // finiaConfirmSplitExpense for the same pattern on Finia's side.
  const [sharedExpense, setSharedExpense] = useState(false);
  const [sharedPersonIds, setSharedPersonIds] = useState([]); // additional people, besides the main `personId`
  const [sharedAmounts, setSharedAmounts] = useState({}); // { [personId]: '80.00' }
  const [sharedAmountsEdited, setSharedAmountsEdited] = useState(false); // true once the user hand-edits a share

  const recognitionRef = useRef(null);
  const fileRef = useRef(null);

  // Sincronizar reglas familiares desde DB al montar
  useEffect(() => {
    if (familyId) syncFamilyRulesFromDB(familyConfig);
  }, [familyId]);

  // Load active trips overlapping today's date
  useEffect(() => {
    if (!familyId) return;
    base44.entities.Trip.filter({ family_id: familyId })
      .then(all => {
        const today = todayISO();
        const active = (all || []).filter(t =>
          (t.status === 'active') &&
          t.start_date <= today && t.end_date >= today
        );
        setActiveTrips(active);
        if (active.length === 1) setTripId(active[0].id);
      })
      .catch(() => {});
  }, [familyId]);

  // Fetch exchange rate when original currency / date changes and trip is selected
  useEffect(() => {
    if (!tripId || !originalCurrency || !currency || originalCurrency === currency) {
      setExchangeRate(originalCurrency === currency ? 1 : null);
      return;
    }
    let cancelled = false;
    setFetchingRate(true);
    getExchangeRate(date || todayISO(), originalCurrency, currency)
      .then(rate => { if (!cancelled) { setExchangeRate(rate); setFetchingRate(false); } })
      .catch(() => { if (!cancelled) { setExchangeRate(null); setFetchingRate(false); } });
    return () => { cancelled = true; };
  }, [tripId, originalCurrency, date, currency]);

  // Auto-calculate amount from originalAmount × exchangeRate
  useEffect(() => {
    if (!tripId || !originalAmount || !exchangeRate) return;
    const val = parseFloat(originalAmount);
    if (!isNaN(val) && exchangeRate > 0) {
      setAmount((val * exchangeRate).toFixed(2));
    }
  }, [originalAmount, exchangeRate, tripId]);

  // Shared-expense participants: the already-selected `personId` plus
  // whoever else is checked in the "Gasto compartido" picker. Requires a
  // person to already be selected — reuses that selection as the first
  // share instead of asking the user to pick everyone twice.
  const sharedParticipantIds = personId ? [personId, ...sharedPersonIds.filter(id => id !== personId)] : [];

  // Divides `total` evenly across `ids.length` people, 2-decimal amounts
  // that sum EXACTLY to total (the last participant absorbs the rounding
  // remainder rather than everyone being off by a cent).
  const equalSplit = (ids, total) => {
    if (!ids.length || !total) return {};
    const each = Math.floor((total / ids.length) * 100) / 100;
    const shares = {};
    let assigned = 0;
    ids.forEach((id, i) => {
      shares[id] = i === ids.length - 1 ? (total - assigned).toFixed(2) : each.toFixed(2);
      assigned += each;
    });
    return shares;
  };

  // Re-split evenly whenever the participant list or total changes — unless
  // the user has already hand-edited a share, which freezes auto-splitting
  // so their edits don't get silently overwritten.
  useEffect(() => {
    if (!sharedExpense || sharedAmountsEdited) return;
    setSharedAmounts(equalSplit(sharedParticipantIds, parseFloat(amount) || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedExpense, sharedAmountsEdited, sharedPersonIds, personId, amount]);

  const sharedTotal = Object.values(sharedAmounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const sharedDiff = (parseFloat(amount) || 0) - sharedTotal;
  const sharedTotalMatches = Math.abs(sharedDiff) < 0.01;

  // Fetch smart suggestions with debounce to avoid rate limiting
  useEffect(() => {
    if (description.length <= 2) {
      setSmartSuggestions({ suggestedCategories: [], suggestedPersons: [], suggestedPaymentMethods: [] });
      return;
    }
    const timer = setTimeout(() => {
      base44.functions.invoke('analytics', { action: 'getSmartSuggestions', familyId, description, type })
        .then(res => setSmartSuggestions(res.data || {}))
        .catch(() => setSmartSuggestions({ suggestedCategories: [], suggestedPersons: [], suggestedPaymentMethods: [] }));
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
    await guardedCreate('Subcategory', {
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
    const cat = await guardedCreate('Category', {
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
          } catch {
            // Ignore non-JSON assistant content and continue with manual input.
          }
          break;
        }
      }
      if (result && typeof result === 'object') {
        const parsed = aiExtractSchema.safeParse(result);
        const data = parsed.success ? parsed.data : {};
        if (data.categoryId) setCategoryId(data.categoryId);
        if (data.subcategoryId) setSubcategoryId(data.subcategoryId);
        if (data.personId) setPersonId(data.personId);
        if (data.paymentMethodId) setPaymentMethodId(data.paymentMethodId);
        if (data.amount !== undefined) setAmount(String(data.amount));
        if (data.date) setDate(data.date);
      }
    } catch {
      // Silent fail — form stays as-is
    } finally {
      setAiExtracting(false);
    }
  };

  const startVoice = () => {
    const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
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

  const checkTripBudgetAlert = async (tId) => {
    try {
      const [tripArr, txs] = await Promise.all([
        base44.entities.Trip.filter({ family_id: familyId }),
        base44.entities.Transaction.filter({ family_id: familyId }),
      ]);
      const t = tripArr.find(x => x.id === tId);
      if (!t?.budget_amount) return;
      // Use computeTripSpent so multi-currency trips (e.g. USD budget) are compared correctly
      const { spent } = computeTripSpent(txs, t, currency);
      const pct = (spent / t.budget_amount) * 100;
      if (pct >= 100) toast({ title: `🚨 Superaste el presupuesto de ${t.name}`, variant: 'destructive' });
      else if (pct >= 90) toast({ title: `🔴 Llevas el 90% del presupuesto de ${t.name}`, variant: 'destructive' });
      else if (pct >= 75) toast({ title: `⚠️ Llevas el 75% del presupuesto de ${t.name}` });
    } catch { /* non-fatal: budget check */ }
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
        if (txData.trip_id) checkTripBudgetAlert(txData.trip_id);
        setSaving(false);
        setShowSuccess(true);
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ['#059669','#10B981','#6EE7B7'] });
        setTimeout(() => {
          setShowSuccess(false);
          setAmount(''); setDescription(''); setCategoryId(''); setSubcategoryId('');
          setNotes(''); setCreditCardBalance(''); setReceiptImage(null); setSuggestions([]);
          setTripDismissed(false); setOriginalCurrency(''); setOriginalAmount('');
          setExchangeRate(null); setIsSplit(false); setSplitWithPersonIds([]);
        }, 1500);
      },
    });
  };

  // Saves a shared expense as N separate Transaction rows (one per person's
  // share), sharing a split_group_id — same shape finiaConfirmSplitExpense
  // writes from the Finia chat flow, so both paths produce identical data.
  // Skips the duplicate-check handleSave does for a single transaction:
  // that check assumes one amount/person and isn't meaningful here.
  const doSaveShared = async () => {
    setSaving(true);
    const week = getWeekNumber(date);
    const splitGroupId = crypto.randomUUID();
    const totalAmount = parseFloat(amount);
    const rows = sharedParticipantIds.map(pid => ({
      date, type, description,
      family_id: familyId,
      category_id: categoryId || undefined,
      subcategory_id: subcategoryId || undefined,
      payment_method_id: paymentMethodId || undefined,
      required_type: requiredType, has_invoice: hasInvoice, notes, week,
      person_id: pid,
      amount: parseFloat(sharedAmounts[pid]) || 0,
      split_group_id: splitGroupId,
      split_total_amount: totalAmount,
    }));
    try {
      await Promise.all(rows.map(r => guardedCreate('Transaction', r)));
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });
      if (subcategoryId) increment(subcategoryId);
      recordCapture({ description, categoryId, subcategoryId, personId, paymentMethodId, type });
      setSaving(false);
      setShowSuccess(true);
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ['#059669', '#10B981', '#6EE7B7'] });
      setTimeout(() => {
        setShowSuccess(false);
        setAmount(''); setDescription(''); setCategoryId(''); setSubcategoryId('');
        setNotes(''); setCreditCardBalance(''); setReceiptImage(null); setSuggestions([]);
        setSharedExpense(false); setSharedPersonIds([]); setSharedAmounts({}); setSharedAmountsEdited(false);
      }, 1500);
    } catch (err) {
      setSaving(false);
      toast({ title: 'Error al guardar', description: err?.message || 'No se pudo guardar el gasto compartido', variant: 'destructive' });
    }
  };

  const validCategories = categories.filter(c => c.type === 'both' || c.type === type);
  const missingCategories = validCategories.length === 0;
  const missingPersons = persons.length === 0;

  const handleSave = async () => {
    if (isReadOnly) { setShowUpgrade(true); return; }
    if (!amount || isNaN(parseFloat(amount))) return;
    if (!categoryId) return;
    if (!personId) return;
    if (sharedExpense) {
      if (sharedParticipantIds.length < 2 || !sharedTotalMatches) return;
      doSaveShared();
      return;
    }
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
      ...(creditCardBalance && selectedCategory?.exclude_from_totals
        ? { credit_card_balance: parseFloat(creditCardBalance) }
        : {}),
      ...(tripId ? { trip_id: tripId } : {}),
      ...(tripId && originalCurrency
        ? {
            original_currency: originalCurrency,
            original_amount: originalCurrency === currency
              ? parseFloat(amount) || undefined
              : parseFloat(originalAmount) || undefined,
            exchange_rate: originalCurrency === currency ? 1 : (exchangeRate || undefined),
          }
        : {}),
      ...(tripId && isSplit ? { is_split: true, split_with_person_ids: splitWithPersonIds } : {}),
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
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Monto ({currency})</p>
            <button
              type="button"
              onClick={() => setShowCalculator(v => !v)}
              className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg transition-colors ${showCalculator ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Calc
            </button>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-light text-muted-foreground">{currencySymbol}</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" inputMode="decimal"
              className="flex-1 font-display text-4xl font-black tracking-tight nums-money bg-transparent border-none outline-none text-foreground placeholder-muted-foreground/30" />
          </div>
          {showCalculator && (
            <CalculatorWidget
              onCalculate={(result) => setAmount(String(result))}
              onClose={() => setShowCalculator(false)}
            />
          )}
        </div>
      </div>

      {/* F2.6 — Atypical amount warning */}
      {atypicalWarning && (
        <div className="px-4 mt-1">
          <p className="text-xs text-warning flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            {atypicalWarning} ¿Continuar?
          </p>
        </div>
      )}

      {/* Trip suggestion chip */}
      {activeTrips.length > 0 && !tripDismissed && type === 'expense' && (
        <div className="px-4 mt-3">
          {activeTrips.length === 1 ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 rounded-xl">
              <Plane className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
              <span className="text-xs text-sky-700 dark:text-sky-400 flex-1">¿Es parte de <strong>{activeTrips[0].name}</strong>?</span>
              <button
                onClick={() => { setTripId(activeTrips[0].id); setOriginalCurrency(activeTrips[0].budget_currency || activeTrips[0].currencies?.[0] || currency); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${tripId ? 'bg-sky-600 text-white' : 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400 hover:bg-sky-200'}`}
              >
                ✓
              </button>
              <button
                onClick={() => { setTripId(''); setTripDismissed(true); }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                ✗
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 rounded-xl">
              <Plane className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
              <select
                value={tripId}
                onChange={e => { setTripId(e.target.value); if (e.target.value) { const t = activeTrips.find(x => x.id === e.target.value); setOriginalCurrency(t?.budget_currency || t?.currencies?.[0] || currency); } }}
                className="flex-1 text-xs bg-transparent text-sky-700 dark:text-sky-400 outline-none"
              >
                <option value="">¿Asignar a viaje?</option>
                {activeTrips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={() => setTripDismissed(true)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Exchange rate fields when trip selected */}
          {tripId && (() => {
            const selectedTrip = activeTrips.find(t => t.id === tripId);
            if (!selectedTrip) return null;
            const currencyOptions = Array.from(new Set([
              selectedTrip.budget_currency,
              ...(selectedTrip.currencies || []),
              currency,
            ].filter(Boolean)));
            const isForeign = originalCurrency && originalCurrency !== currency;
            return (
              <div className="mt-2 space-y-2 pl-1">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground mb-1 block">¿En qué moneda gastaste?</label>
                    <select
                      value={originalCurrency}
                      onChange={e => setOriginalCurrency(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {currencyOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {isForeign && (
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-1 block">Monto en {originalCurrency}</label>
                      <input
                        type="number"
                        value={originalAmount}
                        onChange={e => setOriginalAmount(e.target.value)}
                        placeholder="0.00"
                        inputMode="decimal"
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  )}
                </div>
                {isForeign && (
                  <p className="text-[11px] text-muted-foreground">
                    {fetchingRate ? 'Obteniendo TC...' : exchangeRate
                      ? `TC: 1 ${originalCurrency} = ${exchangeRate} ${currency} · ${date || 'Hoy'}`
                      : 'No se pudo obtener el TC. Ingresa el monto manualmente.'}
                  </p>
                )}
                {/* Split button — only when trip has multiple participants */}
                {(selectedTrip.participant_person_ids?.length || 0) > 1 && (
                  <button
                    onClick={() => setIsSplit(!isSplit)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${isSplit ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Dividir gasto
                  </button>
                )}
                {isSplit && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">¿Con quién divides?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedTrip.participant_person_ids || []).map(pid => {
                        const p = persons.find(x => x.id === pid);
                        if (!p) return null;
                        const checked = splitWithPersonIds.includes(pid);
                        return (
                          <button key={pid} onClick={() => setSplitWithPersonIds(prev => checked ? prev.filter(x => x !== pid) : [...prev, pid])}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${checked ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                          >
                            <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: p.color || '#059669' }}>
                              {(p.avatar_initial || p.name?.[0] || '?').toUpperCase()}
                            </span>
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                    {splitWithPersonIds.length > 0 && amount && (
                      <p className="text-[11px] text-muted-foreground">
                        Tu parte: {formatCurrency(parseFloat(amount) / (splitWithPersonIds.length + 1), { locale, currency })} (de {formatCurrency(parseFloat(amount), { locale, currency })} total)
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
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
                className="flex items-center justify-center p-2 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 transition-all touch-target disabled:opacity-60">
                {aiExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </button>
            )}
            <button onClick={isListening ? stopVoice : startVoice}
              className={`flex items-center justify-center p-2 rounded-lg transition-all touch-target ${isListening ? 'bg-expense text-white animate-pulse-ring' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground touch-target">
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
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/25 hover:bg-secondary/20 transition-colors">
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
            <Sparkles className="w-3.5 h-3.5 text-secondary" />
            <p className="text-xs font-semibold text-secondary">Rubros frecuentes</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {smartSuggestions.suggestedCategories.map((cat, i) => (
              <button
                key={i}
                onClick={() => { setCategoryId(cat.id); setSubcategoryId(''); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/25 hover:bg-secondary/20 transition-colors"
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
            <Sparkles className="w-3.5 h-3.5 text-secondary" />
            <p className="text-xs font-semibold text-secondary">Personas frecuentes</p>
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
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border border-secondary/25 bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors"
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

      {/* Gasto compartido — one purchase, paid unevenly by 2+ people */}
      {personId && persons.length > 1 && (
        <div className="px-4 mt-3">
          <button
            onClick={() => {
              const next = !sharedExpense;
              setSharedExpense(next);
              if (!next) { setSharedPersonIds([]); setSharedAmounts({}); setSharedAmountsEdited(false); }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors touch-target"
            style={sharedExpense
              ? { borderColor: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }
              : undefined}
          >
            <Users className="w-3.5 h-3.5" />
            Gasto compartido
          </button>

          {sharedExpense && (
            <div className="mt-2 p-3 rounded-xl border border-border bg-muted/30 space-y-2">
              <p className="text-xs text-muted-foreground">¿Con quién más se repartió este gasto?</p>
              <div className="flex gap-2 flex-wrap">
                {persons.filter(p => p.id !== personId).map(p => {
                  const checked = sharedPersonIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSharedAmountsEdited(false);
                        setSharedPersonIds(prev => checked ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors touch-target"
                      style={checked ? { backgroundColor: p.color, borderColor: p.color, color: '#fff' } : undefined}
                    >
                      <PersonAvatar person={p} size="xs" />
                      {p.name}
                    </button>
                  );
                })}
              </div>

              {sharedParticipantIds.length > 1 && (
                <div className="space-y-1.5 pt-1">
                  {sharedParticipantIds.map(pid => {
                    const p = persons.find(x => x.id === pid);
                    return (
                      <div key={pid} className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-foreground w-24 flex-shrink-0 truncate">
                          <PersonAvatar person={p} size="xs" />{p?.name}
                        </span>
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currencySymbol}</span>
                          <input
                            type="number" inputMode="decimal" value={sharedAmounts[pid] ?? ''}
                            onChange={e => { setSharedAmountsEdited(true); setSharedAmounts(prev => ({ ...prev, [pid]: e.target.value })); }}
                            className="w-full bg-card border border-border rounded-lg pl-6 pr-2 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-0.5">
                    <button onClick={() => setSharedAmountsEdited(false)} className="text-[11px] text-primary underline underline-offset-2 py-1">
                      Dividir parejo
                    </button>
                    <p className={`text-[11px] font-medium ${sharedTotalMatches ? 'text-income' : 'text-expense'}`}>
                      {sharedTotalMatches
                        ? '✓ Cuadra con el total'
                        : sharedDiff > 0 ? `Faltan ${fmtMXN(sharedDiff)}` : `Sobran ${fmtMXN(-sharedDiff)}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Smart suggestions for payment methods */}
      {smartSuggestions.suggestedPaymentMethods.length > 0 && (
        <div className="px-4 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-secondary" />
            <p className="text-xs font-semibold text-secondary">Formas de pago frecuentes</p>
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {smartSuggestions.suggestedPaymentMethods.map(m => (
              <button
                key={m.id}
                onClick={() => setPaymentMethodId(paymentMethodId === m.id ? '' : m.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all ${
                  paymentMethodId === m.id
                    ? 'bg-secondary text-secondary-foreground border-secondary'
                    : 'border-secondary/25 bg-secondary/10 text-secondary hover:bg-secondary/20'
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
            onClick={e => e.target.showPicker?.()}
            className="w-full bg-card border border-border rounded-xl pl-3 pr-10 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer" />
          <CalendarDays
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
          />
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

      {/* Invoice toggle + notes (advanced), grouped into one card */}
      {canUseAdvanced && (
        <div className="px-4 mt-2">
          <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
            {type === 'expense' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Con factura</span>
                </div>
                <Switch checked={hasInvoice} onCheckedChange={setHasInvoice} />
              </div>
            )}
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notas (opcional)"
              className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
      )}

      {/* Saldo pendiente TDC — shown only for categories marked exclude_from_totals */}
      {selectedCategory?.exclude_from_totals && (
        <div className="px-4 mt-2">
          <Alert variant="info" className="rounded-2xl space-y-2">
            <p className="text-xs font-semibold">💳 Pago TDC — solo informativo, no suma al gasto</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Saldo pendiente después de este pago (opcional)</label>
              <div className="flex items-baseline gap-1 bg-card border border-border rounded-xl px-3 py-2.5">
                <span className="text-sm text-muted-foreground">{currencySymbol}</span>
                <input
                  type="number"
                  value={creditCardBalance}
                  onChange={e => setCreditCardBalance(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="flex-1 text-sm bg-transparent border-none outline-none text-foreground placeholder-muted-foreground/40"
                />
              </div>
            </div>
          </Alert>
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
          <button onClick={handleSave}
            disabled={!amount || !categoryId || !personId || saving || (sharedExpense && (sharedParticipantIds.length < 2 || !sharedTotalMatches))}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all touch-target">
            {saving ? 'Guardando...' : sharedExpense ? `Guardar (${sharedParticipantIds.length} movimientos)` : 'Guardar'}
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
                        {d.type === 'expense' ? '-' : '+'}{formatCurrency(d.amount, { locale, currency, decimals: 2 })}
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