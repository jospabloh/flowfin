import { useState, useMemo, useEffect, useCallback } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import Spinner from '@/components/Spinner';
import { Download, AlertTriangle, MessageCircle } from 'lucide-react';
import writeXlsxFile from 'write-excel-file/browser';
import PageHeader from '@/components/PageHeader';
import { Alert } from '@/components/ui/alert';
import EmptyState from '@/components/EmptyState';
import { useCatalog } from '@/hooks/useCatalog';
import { useFamily } from '@/lib/FamilyContext';
import { Link } from 'react-router-dom';
import TransactionEditModal from '@/components/TransactionEditModal';
import TransactionFilters from '@/components/transactions/TransactionFilters';
import TransactionGroup from '@/components/transactions/TransactionGroup';
import ConvertScheduledModal from '@/components/transactions/ConvertScheduledModal';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm.jsx';
import { usePermission, useCanView } from '@/lib/permissions/usePermission';

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
  const { familyId, currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const { toast } = useToast();
  const { confirmDelete, ConfirmDialog } = useDeleteConfirm();
  const { categories = [], subcategories = [], persons = [], paymentMethods = [] } = useCatalog(familyId);

  const canViewList          = useCanView('transaction.view.list');
  const canViewFilter        = useCanView('transaction.view.filter');
  const canViewSearch        = useCanView('transaction.view.search');
  const canViewPendingBanner = useCanView('transaction.view.pending_banner');
  const { can_read: canExport } = usePermission('transaction.view.export');

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCat, setFilterCat] = useState('');
  const [filterPerson, setFilterPerson] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const [converting, setConverting] = useState(null);
  const [allTransactions, setAllTransactions] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 100;

  const { data: paginatedData = { transactions: [], hasMore: true }, isLoading, refetch: refetchTx } = useQuery({
    queryKey: ['transactions', familyId],
    queryFn: async () => {
      const txs = await base44.entities.Transaction.filter({ family_id: familyId }, '-date', pageSize);
      return { transactions: txs, hasMore: txs.length === pageSize };
    },
    enabled: !!familyId,
  });

  useEffect(() => { setAllTransactions(paginatedData.transactions); setHasMore(paginatedData.hasMore); }, [paginatedData]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || !familyId) return;
    const nextBatch = await base44.entities.Transaction.filter({ family_id: familyId }, '-date', pageSize, allTransactions.length);
    setAllTransactions(prev => [...prev, ...nextBatch]);
    setHasMore(nextBatch.length === pageSize);
  }, [hasMore, familyId, allTransactions.length]);

  const { refreshing } = usePullToRefresh(refetchTx);

  const deleteTransactionMutation = useMutation({
    mutationFn: (id) => base44.entities.Transaction.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      const previous = queryClient.getQueryData(['transactions']);
      queryClient.setQueryData(['transactions'], (old = []) => old.filter(t => t.id !== id));
      return { previous };
    },
    onError: (err, _, ctx) => { if (ctx?.previous) queryClient.setQueryData(['transactions'], ctx.previous); toast({ title: 'Error al eliminar', description: err?.message, variant: 'destructive' }); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });

  const filtered = useMemo(() => (allTransactions || []).filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterCat && t.category_id !== filterCat) return false;
    if (filterPerson && t.person_id !== filterPerson) return false;
    if (search) {
      const q = search.toLowerCase();
      const cat = (categories || []).find(c => c.id === t.category_id);
      return (t.description || '').toLowerCase().includes(q) || (cat?.name || '').toLowerCase().includes(q);
    }
    return true;
  }), [allTransactions, filterType, filterCat, filterPerson, search, categories]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);
  const activeFilters = [filterType !== 'all', filterCat, filterPerson].filter(Boolean).length;
  const pending = allTransactions.filter(t => !t.person_id || !t.category_id);

  const handleDelete = async (id) => { if (await confirmDelete('¿Eliminar este movimiento? Esta acción no se puede deshacer.')) deleteTransactionMutation.mutate(id); };
  const handleEditSaved = () => { queryClient.invalidateQueries({ queryKey: ['transactions', familyId] }); queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] }); };

  const handleExport = async () => {
    const columns = [
      { header: 'Fecha', cell: (t) => ({ value: t.date || '' }) },
      { header: 'Tipo', cell: (t) => ({ value: t.type === 'expense' ? 'Egreso' : 'Ingreso' }) },
      { header: 'Monto', cell: (t) => ({ value: t.amount == null ? null : Number(t.amount), type: Number }) },
      { header: 'Descripción', cell: (t) => ({ value: t.description || '' }) },
      { header: 'Rubro', cell: (t) => ({ value: categories.find(c => c.id === t.category_id)?.name || '' }) },
      { header: 'SubRubro', cell: (t) => ({ value: subcategories.find(s => s.id === t.subcategory_id)?.name || '' }) },
      { header: 'Quien', cell: (t) => ({ value: persons.find(p => p.id === t.person_id)?.name || '' }) },
      { header: 'Forma', cell: (t) => ({ value: paymentMethods.find(m => m.id === t.payment_method_id)?.name || '' }) },
      { header: 'Requerido', cell: (t) => ({ value: t.required_type || '' }) },
      { header: 'Factura', cell: (t) => ({ value: t.has_invoice ? 'Sí' : 'No' }) },
      { header: 'Notas', cell: (t) => ({ value: t.notes || '' }) },
    ];
    await writeXlsxFile(filtered, {
      columns,
      sheet: 'Movimientos',
    }).toFile(`FlowFin_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="pb-4">
      <ConfirmDialog />
      {editing && (
        <TransactionEditModal transaction={editing} categories={categories} subcategories={subcategories}
          persons={persons} paymentMethods={paymentMethods} onClose={() => setEditing(null)} onSaved={handleEditSaved} />
      )}
      {converting && (
        <ConvertScheduledModal transaction={converting} categories={categories} paymentMethods={paymentMethods}
          persons={persons} onClose={() => setConverting(null)} onCreated={() => queryClient.invalidateQueries({ queryKey: ['scheduled_payments'] })} />
      )}
      {refreshing && (
        <div className="flex justify-center py-3"><Spinner size="sm" /></div>
      )}

      <PageHeader title="Movimientos" subtitle={`${filtered.length} registros`}
        action={canExport ? (
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-xl text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        ) : null} />

      {(canViewSearch || canViewFilter) && (
        <TransactionFilters search={search} setSearch={setSearch} showFilters={showFilters && canViewFilter} setShowFilters={canViewFilter ? setShowFilters : () => {}}
          filterType={filterType} setFilterType={setFilterType} filterCat={filterCat} setFilterCat={setFilterCat}
          filterPerson={filterPerson} setFilterPerson={setFilterPerson} categories={categories} persons={persons} activeFilters={activeFilters} />
      )}

      {canViewPendingBanner && pending.length > 0 && (
        <Alert variant="warning" className="mx-4 mb-3 rounded-2xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{pending.length} movimiento{pending.length > 1 ? 's' : ''} pendiente{pending.length > 1 ? 's' : ''} de revisar</p>
              <p className="text-xs mt-0.5 opacity-90">Falta asignar persona o categoría.</p>
            </div>
            <Link to="/Assistant" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-warning text-warning-foreground text-xs font-semibold flex-shrink-0 hover:bg-warning/90 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" /> Asistente
            </Link>
          </div>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !canViewList ? null : groups.length === 0 ? (
        <EmptyState icon="📋" title="Sin movimientos" description="Captura tu primer movimiento con el botón +" />
      ) : (
        <div>
          {groups.map(([date, txns]) => (
            <TransactionGroup key={date} date={date} txns={txns} expanded={expanded} setExpanded={setExpanded}
              categories={categories} subcategories={subcategories} persons={persons} paymentMethods={paymentMethods}
              currency={currency} locale={locale} onEdit={setEditing} onDelete={handleDelete} onConvertScheduled={setConverting} />
          ))}
          {hasMore && (
            <div className="flex justify-center py-4">
              <button onClick={handleLoadMore} className="px-4 py-2 bg-muted rounded-xl text-sm text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors">Cargar más</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}