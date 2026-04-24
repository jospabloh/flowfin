import { useState, useMemo, useEffect, useCallback } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import Spinner from '@/components/Spinner';
import { Download, AlertTriangle, MessageCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { useCatalog } from '@/hooks/useCatalog';
import { useFamily } from '@/lib/FamilyContext';
import { Link } from 'react-router-dom';
import TransactionEditModal from '@/components/TransactionEditModal';
import TransactionFilters from '@/components/transactions/TransactionFilters';
import TransactionGroup from '@/components/transactions/TransactionGroup';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm.jsx';
import { useT } from '@/lib/i18n/useT';

function groupByDate(transactions) {
  const groups = {};
  transactions.forEach(t => {
    const key = t.date || '__nodate__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function Transactions() {
  const t = useT();
  const queryClient = useQueryClient();
  const { familyId, currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const { toast } = useToast();
  const { confirmDelete, ConfirmDialog } = useDeleteConfirm();
  const { categories = [], subcategories = [], persons = [], paymentMethods = [] } = useCatalog(familyId);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCat, setFilterCat] = useState('');
  const [filterPerson, setFilterPerson] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
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
    onError: (err, _, ctx) => { if (ctx?.previous) queryClient.setQueryData(['transactions'], ctx.previous); toast({ title: t('transactions.errorDelete'), description: err?.message, variant: 'destructive' }); },
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

  const handleDelete = async (id) => { if (await confirmDelete(t('transactions.confirmDelete'))) deleteTransactionMutation.mutate(id); };
  const handleEditSaved = () => { queryClient.invalidateQueries({ queryKey: ['transactions', familyId] }); queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] }); };

  const handleExport = () => {
    const h = t('transactions.excelHeaders');
    const rows = filtered.map(tx => ({
      [h.date]: tx.date,
      [h.type]: tx.type === 'expense' ? t('transactions.typeLabel.expense') : t('transactions.typeLabel.income'),
      [h.amount]: tx.amount,
      [h.description]: tx.description || '',
      [h.category]: categories.find(c => c.id === tx.category_id)?.name || '',
      [h.subcategory]: subcategories.find(s => s.id === tx.subcategory_id)?.name || '',
      [h.who]: persons.find(p => p.id === tx.person_id)?.name || '',
      [h.method]: paymentMethods.find(m => m.id === tx.payment_method_id)?.name || '',
      [h.required]: tx.required_type || '',
      [h.invoice]: tx.has_invoice ? t('common.yes') : t('common.no'),
      [h.notes]: tx.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('transactions.excelSheetName'));
    XLSX.writeFile(wb, `FlowFin_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="pb-4">
      <ConfirmDialog />
      {editing && (
        <TransactionEditModal transaction={editing} categories={categories} subcategories={subcategories}
          persons={persons} paymentMethods={paymentMethods} onClose={() => setEditing(null)} onSaved={handleEditSaved} />
      )}
      {refreshing && (
        <div className="flex justify-center py-3"><Spinner size="sm" /></div>
      )}

      <PageHeader title={t('transactions.title')} subtitle={t('transactions.recordsCount').replace('{count}', filtered.length)}
        action={
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-xl text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> {t('transactions.excelButton')}
          </button>
        } />

      <TransactionFilters search={search} setSearch={setSearch} showFilters={showFilters} setShowFilters={setShowFilters}
        filterType={filterType} setFilterType={setFilterType} filterCat={filterCat} setFilterCat={setFilterCat}
        filterPerson={filterPerson} setFilterPerson={setFilterPerson} categories={categories} persons={persons} activeFilters={activeFilters} />

      {pending.length > 0 && (
        <div className="mx-4 mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {pending.length === 1 ? t('transactions.pendingOne').replace('{count}', 1) : t('transactions.pendingMany').replace('{count}', pending.length)}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{t('transactions.pendingHint')}</p>
          </div>
          <Link to="/Assistant" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold flex-shrink-0 hover:bg-amber-600 transition-colors">
            <MessageCircle className="w-3.5 h-3.5" /> {t('transactions.assistantButton')}
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : groups.length === 0 ? (
        <EmptyState icon="📋" title={t('transactions.emptyTitle')} description={t('transactions.emptyDesc')} />
      ) : (
        <div>
          {groups.map(([date, txns]) => (
            <TransactionGroup key={date} date={date} txns={txns} expanded={expanded} setExpanded={setExpanded}
              categories={categories} subcategories={subcategories} persons={persons} paymentMethods={paymentMethods}
              currency={currency} locale={locale} onEdit={setEditing} onDelete={handleDelete} />
          ))}
          {hasMore && (
            <div className="flex justify-center py-4">
              <button onClick={handleLoadMore} className="px-4 py-2 bg-muted rounded-xl text-sm text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors">{t('transactions.loadMore')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}