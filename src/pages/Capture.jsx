import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Mic, MicOff, Camera, Check, Receipt, AlertTriangle } from 'lucide-react';
import NativeSelect from '@/components/NativeSelect';
import { motion, AnimatePresence } from 'framer-motion';
import { useCatalog } from '@/hooks/useCatalog';
import { useFamily } from '@/lib/FamilyContext';
import { matchCategory, parseVoiceText, getWeekNumber } from '@/lib/categoryMatcher';
import { useUsageStats } from '@/lib/useUsageStats';
import confetti from 'canvas-confetti';
import PersonAvatar from '@/components/PersonAvatar';

const REQUIRED_TYPES = ['Necesario', 'Gusto', 'Urgente', 'Inversión', 'Otro'];

export default function Capture() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { familyId, currency, currencySymbol } = useFamily();
  const { categories, subcategories, persons, paymentMethods } = useCatalog(familyId);
  const { stats, increment } = useUsageStats();

  const today = new Date().toISOString().split('T')[0];

  const createTransactionMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });
    },
    onError: (err) => {
      alert(`Error al guardar: ${err?.message || 'No se pudo guardar el movimiento'}`);
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
  const [isListening, setIsListening] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { duplicates: [], pendingData: {} }

  const recognitionRef = useRef(null);
  const fileRef = useRef(null);

  const handleDescriptionChange = useCallback((val) => {
    setDescription(val);
    if (val.length > 1) {
      const matches = matchCategory(val, subcategories, categories, stats);
      setSuggestions(matches.slice(0, 4));
    } else {
      setSuggestions([]);
    }
  }, [subcategories, categories, stats]);

  const applySuggestion = (s) => {
    setCategoryId(s.category?.id || '');
    setSubcategoryId(s.subcategory?.id || '');
    // Keep the user's typed description as-is
    setSuggestions([]);
  };

  const handleAddSubcategory = async (name) => {
    if (!categoryId) { alert('Selecciona primero un Rubro'); return; }
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

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz'); return; }
    const r = new SR();
    r.lang = 'es-MX';
    r.continuous = false;
    r.interimResults = false;
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    r.onresult = (e) => {
      const text = e.results[0][0].transcript;
      const { amount: parsedAmount, description: parsedDesc } = parseVoiceText(text);
      if (parsedAmount) setAmount(String(parsedAmount));
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
    createTransactionMutation.mutate(txData, {
      onSuccess: () => {
        if (subcategoryId) increment(subcategoryId);
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

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount))) return;
    if (!categoryId) { alert('Debes seleccionar un Rubro'); return; }
    if (!personId) { alert('Debes seleccionar una Persona'); return; }
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

    // Check for duplicates on the same date
    const existingOnDate = await base44.entities.Transaction.filter({
      family_id: familyId,
      date,
      type,
    });

    const inputAmount = parseFloat(amount);
    const duplicates = existingOnDate.filter(t => {
      const sameAmount = Math.abs(t.amount - inputAmount) / Math.max(inputAmount, 1) < 0.05; // within 5%
      const sameCat = t.category_id === categoryId;
      const sameSubcat = subcategoryId && t.subcategory_id === subcategoryId;
      const descA = (t.description || '').toLowerCase().trim();
      const descB = description.toLowerCase().trim();
      const sameDesc = descA.length > 2 && descB.length > 2 && (descA.includes(descB) || descB.includes(descA));
      // Only flag as duplicate if amount is similar AND (same subcategory OR same description)
      return sameAmount && sameCat && (sameSubcat || sameDesc);
    });

    if (duplicates.length > 0) {
      setSaving(false);
      setDuplicateWarning({ duplicates, pendingData: txData });
      return;
    }

    doSave(txData);
  };

  const selectedCategory = categories.find(c => c.id === categoryId);
  const selectedSubcategory = subcategories.find(s => s.id === subcategoryId);
  const selectedPerson = persons.find(p => p.id === personId);
  const selectedMethod = paymentMethods.find(m => m.id === paymentMethodId);

  return (
   <div className="min-h-screen pb-4 overscroll-none" onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}>
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

      {/* Description + voice/camera */}
      <div className="px-4 mt-3">
        <div className="relative">
          <input type="text" value={description} onChange={e => handleDescriptionChange(e.target.value)}
            placeholder={type === 'expense' ? '¿En qué gastaste? (gasolina, mandado...)' : '¿De dónde viene? (sueldo, renta...)'}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 pr-24 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
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

      {/* Category + Subcategory */}
      <div className={`grid gap-2 px-4 mt-3 ${type === 'expense' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <NativeSelect
          value={categoryId}
          onChange={e => { setCategoryId(e.target.value); setSubcategoryId(''); }}
          placeholder="Rubro"
          options={categories.filter(c => c.type === 'both' || c.type === type).map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
          className={`bg-card border rounded-xl px-3 py-2.5 text-sm w-full ${!categoryId ? 'border-expense/60 bg-expense/5' : 'border-border'}`}
        />
        {type === 'expense' && (
          <NativeSelect
            value={subcategoryId}
            onChange={e => setSubcategoryId(e.target.value)}
            placeholder="SubRubro"
            options={subcategories.filter(s => s.category_id === categoryId).map(s => ({ value: s.id, label: s.name }))}
            className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm w-full"
          />
        )}
      </div>

      {/* Person selector */}
      {persons.length > 0 && (
        <div className="flex gap-2 px-4 mt-3 overflow-x-auto hide-scrollbar">
          <button onClick={() => setPersonId('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap
              ${!personId ? 'bg-expense/10 text-expense border-expense/40' : 'border-border text-muted-foreground'}`}>
            Sin persona ⚠️
          </button>
          {persons.map(p => (
            <button key={p.id} onClick={() => setPersonId(p.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap
                ${personId === p.id ? 'text-white border-transparent' : 'border-border text-muted-foreground'}`}
              style={personId === p.id ? { backgroundColor: p.color, borderColor: p.color } : {}}>
              <PersonAvatar person={p} size="xs" />
              {p.name}
            </button>
          ))}
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
      <div className={`grid gap-2 px-4 mt-3 ${type === 'expense' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="relative">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          {date !== today && (
            <span className="absolute -top-2 left-3 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
              {date < today.slice(0, 7) ? 'Mes anterior' : 'Fecha pasada'}
            </span>
          )}
        </div>
        {type === 'expense' && (
          <NativeSelect
            value={requiredType}
            onChange={e => setRequiredType(e.target.value)}
            placeholder="Clasificación"
            options={REQUIRED_TYPES.map(r => ({ value: r, label: r }))}
            className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm w-full"
          />
        )}
      </div>

      {/* Invoice toggle (expense only) */}
      {type === 'expense' && (
        <div className="px-4 mt-2">
          <button onClick={() => setHasInvoice(!hasInvoice)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all
              ${hasInvoice ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground'}`}>
            <Receipt className="w-3.5 h-3.5" />
            Con factura
          </button>
        </div>
      )}

      {/* Notes */}
      <div className="px-4 mt-2">
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Notas (opcional)"
          className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      {/* Save button */}
      <div className="px-4 mt-4">
        <button onClick={handleSave} disabled={!amount || !categoryId || !personId || saving}
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all touch-target">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
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
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
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
                        {d.type === 'expense' ? '-' : '+'}{currencySymbol}{d.amount?.toLocaleString()}
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