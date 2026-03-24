import { useState, useMemo } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Filter, Download, Trash2, ChevronDown, ChevronUp, X, AlertTriangle, MessageCircle, Pencil } from 'lucide-react';
import NativeSelect from '@/components/NativeSelect';
import * as XLSX from 'xlsx';
import PageHeader from '@/components/PageHeader';
import AmountDisplay from '@/components/AmountDisplay';
import PersonAvatar from '@/components/PersonAvatar';
import CategoryDot from '@/components/CategoryDot';
import EmptyState from '@/components/EmptyState';
import { useCatalog } from '@/hooks/useCatalog';
import { useFamily } from '@/lib/FamilyContext';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import TransactionEditModal from '@/components/TransactionEditModal';
import { Virtuoso } from 'react-virtuoso';
function groupByDate(transactions) {
  const groups = {};
  transactions.forEach(t => {
    const key = t.date || 'Sin fecha';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function Transactions() {
  const queryClient = useQueryClient();
  const { familyId } = useFamily();
  const { categories, subcategories, persons, paymentMethods } = useCatalog(familyId);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCat, setFilterCat] = useState('');
  const [filterPerson, setFilterPerson] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);

  const handleEdit = (t) => { setEditing(t); };
  const handleEditSaved = () => { queryClient.invalidateQueries({ queryKey: ['transactions'] }); };

  const { data: transactions = [], isLoading, refetch: refetchTx } = useQuery({
    queryKey: ['transactions', familyId],
    queryFn: () => base44.entities.Transaction.filter({ family_id: familyId }, '-date', 1000),
    enabled: !!familyId,
  });

  const { refreshing } = usePullToRefresh(refetchTx);

  const filtered = useMemo(() => transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterCat && t.category_id !== filterCat) return false;
    if (filterPerson && t.person_id !== filterPerson) return false;
    if (search) {
      const q = search.toLowerCase();
      const cat = categories.find(c => c.id === t.category_id);
      return (t.description || '').toLowerCase().includes(q) ||
        (cat?.name || '').toLowerCase().includes(q);
    }
    return true;
  }), [transactions, filterType, filterCat, filterPerson, search, categories]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este movimiento?')) return;
    await base44.entities.Transaction.delete(id);
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };

  const handleExport = () => {
    const rows = filtered.map(t => ({
      Fecha: t.date, Tipo: t.type === 'expense' ? 'Egreso' : 'Ingreso',
      Monto: t.amount, Descripción: t.description || '',
      Rubro: categories.find(c => c.id === t.category_id)?.name || '',
      SubRubro: subcategories.find(s => s.id === t.subcategory_id)?.name || '',
      Quien: persons.find(p => p.id === t.person_id)?.name || '',
      Forma: paymentMethods.find(m => m.id === t.payment_method_id)?.name || '',
      Requerido: t.required_type || '',
      Factura: t.has_invoice ? 'Sí' : 'No',
      Notas: t.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    XLSX.writeFile(wb, `FamilyFlow_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const activeFilters = [filterType !== 'all', filterCat, filterPerson].filter(Boolean).length;

  return (
    <div className="pb-4">
      {editing && (
        <TransactionEditModal
          transaction={editing}
          categories={categories}
          subcategories={subcategories}
          persons={persons}
          paymentMethods={paymentMethods}
          onClose={() => setEditing(null)}
          onSaved={handleEditSaved}
        />
      )}
      {refreshing && (
        <div className="flex justify-center py-3">
          <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      )}
      <PageHeader title="Movimientos" subtitle={`${filtered.length} registros`}
        action={
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-xl text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        } />

      {/* Search & filter */}
      <div className="flex gap-2 px-4 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..." className="w-full pl-9 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground" /></button>}
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all
            ${activeFilters > 0 ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'}`}>
          <Filter className="w-4 h-4" />
          {activeFilters > 0 && <span className="text-xs">{activeFilters}</span>}
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mx-4 mb-3 p-3 bg-card border border-border rounded-2xl space-y-2">
          <div className="flex gap-2">
            {[{ v: 'all', l: 'Todos' }, { v: 'expense', l: 'Egresos' }, { v: 'income', l: 'Ingresos' }].map(f => (
              <button key={f.v} onClick={() => setFilterType(f.v)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${filterType === f.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {f.l}
              </button>
            ))}
          </div>
          <NativeSelect
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            placeholder="Todos los rubros"
            options={[{ value: '', label: 'Todos los rubros' }, ...categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))]}
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm"
          />
          <NativeSelect
            value={filterPerson}
            onChange={e => setFilterPerson(e.target.value)}
            placeholder="Todas las personas"
            options={[{ value: '', label: 'Todas las personas' }, ...persons.map(p => ({ value: p.id, label: p.name }))]}
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm"
          />
          {activeFilters > 0 && (
            <button onClick={() => { setFilterType('all'); setFilterCat(''); setFilterPerson(''); }}
              className="w-full py-1.5 rounded-lg text-xs font-medium text-muted-foreground bg-muted hover:bg-destructive/10 hover:text-destructive transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Pending banner */}
      {(() => {
        const pending = transactions.filter(t => !t.person_id || !t.category_id);
        if (pending.length === 0) return null;
        return (
          <div className="mx-4 mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {pending.length} movimiento{pending.length > 1 ? 's' : ''} pendiente{pending.length > 1 ? 's' : ''} de revisar
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Falta asignar persona o categoría. Pídele al Asistente IA que los complete.
              </p>
            </div>
            <Link to="/Assistant" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold flex-shrink-0 hover:bg-amber-600 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" /> Asistente
            </Link>
          </div>
        );
      })()}

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : groups.length === 0 ? (
        <EmptyState icon="📋" title="Sin movimientos" description="Captura tu primer movimiento con el botón +" />
      ) : (
        <Virtuoso
          useWindowScroll
          data={groups}
          itemContent={(_, [date, txns]) => (
            <div className="px-4 mb-4" key={date}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {date !== 'Sin fecha' ? format(parseISO(date), "EEEE d 'de' MMMM", { locale: es }).replace(/^\w/, c => c.toUpperCase()) : 'Sin fecha'}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">
                  {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(
                    txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
                  )}
                </span>
              </div>
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                {txns.map((t, idx) => {
                  const cat = categories.find(c => c.id === t.category_id);
                  const sub = subcategories.find(s => s.id === t.subcategory_id);
                  const person = persons.find(p => p.id === t.person_id);
                  const isExp = expanded === t.id;
                  const desc = t.description || cat?.name || 'Sin descripción';
                  return (
                    <div key={t.id} className={idx < txns.length - 1 ? 'border-b border-border' : ''}>
                      {(!t.person_id || !t.category_id) && (
                        <div className="flex items-center gap-1.5 px-4 pt-2 pb-0" role="alert">
                          <AlertTriangle className="w-3 h-3 text-amber-500" aria-hidden="true" />
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            Pendiente de revisar — falta {!t.category_id && !t.person_id ? 'categoría y persona' : !t.category_id ? 'categoría' : 'persona'}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => setExpanded(isExp ? null : t.id)}
                        aria-expanded={isExp}
                        aria-label={`${desc}, ${t.type === 'expense' ? 'egreso' : 'ingreso'} de ${t.amount}`}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left">
                        <div className="w-2 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color || '#94a3b8' }} aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{desc}</p>
                            <AmountDisplay amount={t.amount} type={t.type} size="sm" />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {sub && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{sub.name}</span>}
                            {person && <PersonAvatar person={person} size="xs" />}
                            {t.required_type && t.required_type !== 'Necesario' && <span className="text-[10px] text-muted-foreground">{t.required_type}</span>}
                          </div>
                        </div>
                        {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />}
                      </button>
                      {isExp && (
                        <div className="px-4 pb-3 bg-muted/30 border-t border-border">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs py-2">
                            {cat && <><span className="text-muted-foreground">Rubro</span><span className="text-foreground">{cat.icon} {cat.name}</span></>}
                            {person && <><span className="text-muted-foreground">Quien</span><span className="text-foreground">{person.name}</span></>}
                            {t.payment_method_id && <><span className="text-muted-foreground">Forma</span><span className="text-foreground">{paymentMethods.find(m => m.id === t.payment_method_id)?.name || '—'}</span></>}
                            {t.required_type && <><span className="text-muted-foreground">Requerido</span><span className="text-foreground">{t.required_type}</span></>}
                            {t.has_invoice && <><span className="text-muted-foreground">Factura</span><span className="text-income">Sí</span></>}
                            {t.notes && <><span className="text-muted-foreground">Notas</span><span className="text-foreground col-span-1">{t.notes}</span></>}
                          </div>
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => handleEdit(t)}
                              aria-label={`Editar ${desc}`}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Editar
                            </button>
                            <button
                              onClick={() => handleDelete(t.id)}
                              aria-label={`Eliminar ${desc}`}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-expense/10 text-expense text-xs font-medium hover:bg-expense/20 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}