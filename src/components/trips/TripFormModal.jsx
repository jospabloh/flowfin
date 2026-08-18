import { useState, useEffect } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { guardedCreate } from '@/lib/guardedWrite';
import { useFamily } from '@/lib/FamilyContext';
import { useCatalog } from '@/hooks/useCatalog';
import { todayISO } from '@/lib/formatters';

const COUNTRY_CURRENCY_MAP = {
  'México': 'MXN',
  'Estados Unidos': 'USD',
  'España': 'EUR',
  'Francia': 'EUR',
  'Italia': 'EUR',
  'Alemania': 'EUR',
  'Reino Unido': 'GBP',
  'Japón': 'JPY',
  'Canadá': 'CAD',
  'Canada': 'CAD',
};

const COMMON_COUNTRIES = [
  'México', 'Estados Unidos', 'España', 'Francia', 'Italia',
  'Alemania', 'Reino Unido', 'Japón', 'Canadá', 'Colombia',
  'Argentina', 'Brasil', 'Chile', 'Perú', 'Costa Rica',
];

export default function TripFormModal({ onClose, onSaved }) {
  const { familyId, currency: familyCurrency, currentUser } = useFamily();
  const { persons } = useCatalog(familyId);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [countries, setCountries] = useState([]);
  const [countryInput, setCountryInput] = useState('');
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
  const [currencies, setCurrencies] = useState([familyCurrency].filter(Boolean));
  const [newCurrency, setNewCurrency] = useState('');
  const [budget, setBudget] = useState('');
  const [budgetCurrency, setBudgetCurrency] = useState(familyCurrency || '');
  const [participantIds, setParticipantIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Auto-suggest currencies from countries
  useEffect(() => {
    const suggested = new Set([familyCurrency].filter(Boolean));
    for (const c of countries) {
      const cur = COUNTRY_CURRENCY_MAP[c];
      if (cur) suggested.add(cur);
    }
    setCurrencies(prev => {
      const merged = [...new Set([...prev, ...suggested])];
      return merged;
    });
  }, [countries, familyCurrency]);

  const addCountry = (c) => {
    const trimmed = c.trim();
    if (!trimmed || countries.includes(trimmed)) return;
    setCountries(prev => [...prev, trimmed]);
    setCountryInput('');
    setShowCountrySuggestions(false);
  };

  const removeCountry = (c) => setCountries(prev => prev.filter(x => x !== c));
  const removeCurrency = (c) => {
    if (c === familyCurrency) return;
    setCurrencies(prev => prev.filter(x => x !== c));
    if (budgetCurrency === c) setBudgetCurrency(familyCurrency || '');
  };

  const addCurrency = () => {
    const val = newCurrency.trim().toUpperCase();
    if (!val || currencies.includes(val)) { setNewCurrency(''); return; }
    setCurrencies(prev => [...prev, val]);
    setNewCurrency('');
  };

  const toggleParticipant = (id) => {
    setParticipantIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Nombre requerido';
    if (!startDate) e.startDate = 'Fecha de inicio requerida';
    if (!endDate) e.endDate = 'Fecha de fin requerida';
    if (startDate && endDate && endDate < startDate) e.endDate = 'Debe ser ≥ fecha inicio';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await guardedCreate('Trip', {
        family_id: familyId,
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        destination_countries: countries,
        currencies,
        budget_amount: budget ? parseFloat(budget) : undefined,
        budget_currency: budget ? (budgetCurrency || familyCurrency) : undefined,
        participant_person_ids: participantIds,
        created_by_user_id: currentUser?.id,
      });
      onSaved();
    } catch (err) {
      setErrors({ save: err?.message || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const countrySuggestions = COMMON_COUNTRIES.filter(c =>
    !countries.includes(c) &&
    c.toLowerCase().includes(countryInput.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-card rounded-t-3xl sm:rounded-3xl border border-border w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-bold text-foreground text-base">Nuevo Viaje</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nombre del viaje *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="París 2025, Cancún Semana Santa..."
              className={`w-full bg-muted border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 ${errors.name ? 'border-red-400' : 'border-border'}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Inicio *</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                onClick={e => e.target.showPicker?.()}
                className={`w-full bg-muted border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer ${errors.startDate ? 'border-red-400' : 'border-border'}`}
              />
              {errors.startDate && <p className="text-xs text-red-500 mt-0.5">{errors.startDate}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Fin *</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={e => setEndDate(e.target.value)}
                onClick={e => e.target.showPicker?.()}
                className={`w-full bg-muted border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer ${errors.endDate ? 'border-red-400' : 'border-border'}`}
              />
              {errors.endDate && <p className="text-xs text-red-500 mt-0.5">{errors.endDate}</p>}
            </div>
          </div>

          {/* Destination countries */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Países destino</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {countries.map(c => (
                <span key={c} className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                  {c}
                  <button onClick={() => removeCountry(c)} className="text-primary/60 hover:text-primary">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                value={countryInput}
                onChange={e => { setCountryInput(e.target.value); setShowCountrySuggestions(true); }}
                onFocus={() => setShowCountrySuggestions(true)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (countrySuggestions[0]) addCountry(countrySuggestions[0]); else addCountry(countryInput); } }}
                placeholder="Escribe un país..."
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
              {showCountrySuggestions && countryInput && countrySuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                  {countrySuggestions.slice(0, 6).map(c => (
                    <button key={c} onMouseDown={() => addCountry(c)}
                      className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Currencies */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Monedas</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {currencies.map(c => (
                <span key={c} className="flex items-center gap-1 px-2.5 py-1 bg-muted rounded-lg text-xs font-mono font-semibold text-foreground">
                  {c}
                  {c !== familyCurrency && (
                    <button onClick={() => removeCurrency(c)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCurrency}
                onChange={e => setNewCurrency(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCurrency(); } }}
                placeholder="+ Agregar (ej: EUR)"
                maxLength={4}
                className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button onClick={addCurrency} className="px-3 py-2 bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Presupuesto (opcional)</label>
              <input
                type="number"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Moneda presupuesto</label>
              <select
                value={budgetCurrency}
                onChange={e => setBudgetCurrency(e.target.value)}
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                {currencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Participants */}
          {persons.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">Participantes</label>
              <div className="grid grid-cols-2 gap-2">
                {persons.map(p => {
                  const selected = participantIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleParticipant(p.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        selected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: p.color || '#059669' }}
                      >
                        {p.avatar_initial || (p.name?.[0] || '?').toUpperCase()}
                      </div>
                      <span className="truncate">{p.name}</span>
                      {selected && <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {errors.save && <p className="text-xs text-red-500">{errors.save}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Crear Viaje'}
          </button>
        </div>
      </div>
    </div>
  );
}
