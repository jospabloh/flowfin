import { Search, Filter, X } from 'lucide-react';
import NativeSelect from '@/components/NativeSelect';

export default function TransactionFilters({ search, setSearch, showFilters, setShowFilters, filterType, setFilterType, filterCat, setFilterCat, filterPerson, setFilterPerson, categories, persons, activeFilters }) {
  return (
    <>
      <div className="flex gap-2 px-4 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            className="w-full pl-9 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 touch-target">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all touch-target
            ${activeFilters > 0 ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'}`}>
          <Filter className="w-4 h-4" />
          {activeFilters > 0 && <span className="text-xs">{activeFilters}</span>}
        </button>
      </div>

      {showFilters && (
        <div className="mx-4 mb-3 p-3 bg-card border border-border rounded-2xl space-y-2">
          <div className="flex gap-2">
            {[{ v: 'all', l: 'Todos' }, { v: 'expense', l: 'Egresos' }, { v: 'income', l: 'Ingresos' }].map(f => (
              <button key={f.v} onClick={() => setFilterType(f.v)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${filterType === f.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {f.l}
              </button>
            ))}
          </div>
          <NativeSelect value={filterCat} onChange={e => setFilterCat(e.target.value)} placeholder="Todos los rubros"
            options={[{ value: '', label: 'Todos los rubros' }, ...categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))]}
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm" />
          <NativeSelect value={filterPerson} onChange={e => setFilterPerson(e.target.value)} placeholder="Todas las personas"
            options={[{ value: '', label: 'Todas las personas' }, ...persons.map(p => ({ value: p.id, label: p.name }))]}
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm" />
          {activeFilters > 0 && (
            <button onClick={() => { setFilterType('all'); setFilterCat(''); setFilterPerson(''); }}
              className="w-full py-1.5 rounded-lg text-xs font-medium text-muted-foreground bg-muted hover:bg-destructive/10 hover:text-destructive transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </>
  );
}