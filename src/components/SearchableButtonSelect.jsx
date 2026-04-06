import { useState, useMemo } from 'react';
import { X } from 'lucide-react';

/**
 * SearchableButtonSelect — Botones filtrados con búsqueda en tiempo real
 * Props: value, onChange, options: [{id, label, icon?}], placeholder, label
 */
export default function SearchableButtonSelect({ value, onChange, options = [], placeholder = '—', label = '' }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(query));
  }, [search, options]);

  const selected = options.find(o => o.id === value);

  return (
    <div className="space-y-2">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      
      {/* Search input */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      />

      {/* Buttons */}
      <div className="flex flex-wrap gap-2">
        {filtered.length > 0 ? (
          filtered.map(opt => (
            <button
              key={opt.id}
              onClick={() => {
                onChange({ target: { value: opt.id } });
                setSearch('');
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px] touch-target whitespace-nowrap ${
                value === opt.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-foreground border border-border hover:bg-muted/70'
              }`}
            >
              {opt.icon && <span>{opt.icon}</span>}
              {opt.label}
            </button>
          ))
        ) : (
          <p className="text-xs text-muted-foreground w-full text-center py-2">Sin resultados</p>
        )}
      </div>

      {/* Selected display */}
      {selected && search === '' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-xs text-muted-foreground">Seleccionado:</span>
          <span className="text-xs font-semibold text-foreground flex-1">{selected.label}</span>
          <button
            onClick={() => {
              onChange({ target: { value: '' } });
              setSearch('');
            }}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}