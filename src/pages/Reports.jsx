import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Share2, Download, Sparkles, Loader2, Check } from 'lucide-react';
import { useMemory } from '@/hooks/useMemory';
import PageHeader from '@/components/PageHeader';
import { useCatalog } from '@/hooks/useCatalog';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency } from '@/lib/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { endOfMonth, subMonths, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import ReportChart from '@/components/reports/ReportChart';
import ReportBreakdown from '@/components/reports/ReportBreakdown';
import ReportDetailSheet from '@/components/reports/ReportDetailSheet';
import { usePermission, useCanView } from '@/lib/permissions/usePermission';
import { createSnapshot, shareSnapshot } from '@/lib/publicSnapshots';
import { track } from '@/lib/analytics';

const PRESETS = {
  expense: [
    { label: 'Por Categoría', rows: 'category', cols: 'none', metric: 'sum', type: 'expense' },
    { label: 'Por Persona', rows: 'person', cols: 'none', metric: 'sum', type: 'expense' },
    { label: 'Mensual', rows: 'month', cols: 'none', metric: 'sum', type: 'expense' },
    { label: 'Por Método Pago', rows: 'method', cols: 'none', metric: 'sum', type: 'expense' },
  ],
  income: [
    { label: 'Por Categoría', rows: 'category', cols: 'none', metric: 'sum', type: 'income' },
    { label: 'Por Persona', rows: 'person', cols: 'none', metric: 'sum', type: 'income' },
    { label: 'Mensual', rows: 'month', cols: 'none', metric: 'sum', type: 'income' },
  ],
  all: [
    { label: 'Comparativa', rows: 'month', cols: 'type', metric: 'sum', type: 'all' },
  ]
};

export default function Reports() {
  const reportRef = useRef(null);
  const { familyId, currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const { categories, persons, paymentMethods } = useCatalog(familyId);
  const { getUserPref, setUserPref } = useMemory();

  const canViewFilter      = useCanView('reports.view.filter');
  const canViewChart       = useCanView('reports.view.charts');
  const canViewBreakdown   = useCanView('reports.view.breakdown');
  const canViewDetail      = useCanView('reports.view.detail');
  const canViewTrends      = useCanView('reports.view.trends');
  const canViewByCategory  = useCanView('reports.view.by_category');
  const canViewByPerson    = useCanView('reports.view.by_person');
  const canViewByMethod    = useCanView('reports.view.by_method');
  const canViewMonthly     = useCanView('reports.view.monthly');
  const canViewComparative = useCanView('reports.view.comparative');
  const { can_read: canExportPDF }   = usePermission('reports.export.pdf');
  const { can_read: canExportImage } = usePermission('reports.export.image');
  const { can_read: canShare }       = usePermission('reports.export.share');

  // Filter presets based on granular permissions
  const filteredPresets = {
    expense: [
      canViewByCategory  && { label: 'Por Categoría',  rows: 'category', cols: 'none', metric: 'sum', type: 'expense' },
      canViewByPerson    && { label: 'Por Persona',     rows: 'person',   cols: 'none', metric: 'sum', type: 'expense' },
      canViewMonthly     && { label: 'Mensual',         rows: 'month',    cols: 'none', metric: 'sum', type: 'expense' },
      canViewByMethod    && { label: 'Por Método Pago', rows: 'method',   cols: 'none', metric: 'sum', type: 'expense' },
    ].filter(Boolean),
    income: [
      canViewByCategory  && { label: 'Por Categoría', rows: 'category', cols: 'none', metric: 'sum', type: 'income' },
      canViewByPerson    && { label: 'Por Persona',    rows: 'person',   cols: 'none', metric: 'sum', type: 'income' },
      canViewMonthly     && { label: 'Mensual',        rows: 'month',    cols: 'none', metric: 'sum', type: 'income' },
    ].filter(Boolean),
    all: [
      canViewComparative && { label: 'Comparativa', rows: 'month', cols: 'type', metric: 'sum', type: 'all' },
    ].filter(Boolean),
  };

  const urlParams = new URLSearchParams(globalThis.location.search);
  const typeParam = urlParams.get('type');
  const [reportType, setReportType] = useState(typeParam === 'income' ? 'income' : typeParam === 'all' ? 'all' : (getUserPref('report_type', 'expense')));
  const [preset, setPreset] = useState(() => getUserPref('report_preset', 0));
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 2), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [sharing, setSharing] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPerson, setFilterPerson] = useState('');
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [snapshotShared, setSnapshotShared] = useState(false);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions_reports', familyId],
    queryFn: () => base44.entities.Transaction.filter({ family_id: familyId }, '-date', 2000),
    enabled: !!familyId,
  });

  const activePresets = (filteredPresets[reportType]?.length ? filteredPresets[reportType] : PRESETS[reportType]);
  const cfg = activePresets[preset] || activePresets[0];

  const excludedCategoryIds = useMemo(
    () => new Set(categories.filter(c => c.exclude_from_totals).map(c => c.id)),
    [categories],
  );

  const filtered = useMemo(() => (Array.isArray(transactions) ? transactions : []).filter(t => {
    if (!t.date) return false;
    if (cfg.type !== 'all' && t.type !== cfg.type) return false;
    if (filterCategory && t.category_id !== filterCategory) return false;
    if (filterPerson && t.person_id !== filterPerson) return false;
    if (!filterCategory && excludedCategoryIds.has(t.category_id)) return false;
    return t.date >= dateFrom && t.date <= dateTo;
  }), [transactions, cfg, dateFrom, dateTo, filterCategory, filterPerson, excludedCategoryIds]);

  const tableData = useMemo(() => {
    const map = {};
    filtered.forEach(t => {
      let rowKey = 'Sin datos';
      if (cfg.rows === 'category') { const c = categories.find(x => x.id === t.category_id); rowKey = c ? `${c.icon} ${c.name}` : 'Sin categoría'; }
      else if (cfg.rows === 'person') rowKey = persons.find(p => p.id === t.person_id)?.name || 'Sin persona';
      else if (cfg.rows === 'month') rowKey = t.date?.slice(0, 7) || 'Sin fecha';
      else if (cfg.rows === 'method') rowKey = paymentMethods.find(m => m.id === t.payment_method_id)?.name || 'Sin forma';
      if (!map[rowKey]) map[rowKey] = { row: rowKey, total: 0, count: 0 };
      map[rowKey].total += t.amount || 0;
      map[rowKey].count++;
    });
    return Object.values(map)
      .map(r => ({ ...r, value: cfg.metric === 'sum' ? r.total : cfg.metric === 'avg' ? r.total / r.count : r.count }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, cfg, categories, persons, paymentMethods]);

  const formatVal = (v) => cfg.metric === 'count' ? v : formatCurrency(v, { locale, currency });
  const totalVal = tableData.reduce((s, r) => s + r.value, 0);

  const detailTransactions = useMemo(() => {
    if (!selectedDetail) return [];
    return filtered.filter(t => {
      if (cfg.rows === 'category') return t.category_id === selectedDetail;
      if (cfg.rows === 'person') return t.person_id === selectedDetail;
      if (cfg.rows === 'method') return t.payment_method_id === selectedDetail;
      if (cfg.rows === 'month') return t.date?.slice(0, 7) === selectedDetail;
      return false;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [selectedDetail, filtered, cfg]);

  const detailLabel = useMemo(() => {
    if (!selectedDetail) return '';
    if (cfg.rows === 'category') { const c = categories.find(x => x.id === selectedDetail); return c ? `${c.icon} ${c.name}` : 'Sin categoría'; }
    if (cfg.rows === 'person') return persons.find(p => p.id === selectedDetail)?.name || 'Sin persona';
    if (cfg.rows === 'method') return paymentMethods.find(m => m.id === selectedDetail)?.name || 'Sin forma';
    if (cfg.rows === 'month') return format(parseISO(selectedDetail + '-01'), 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase());
    return '';
  }, [selectedDetail, cfg, categories, persons, paymentMethods]);

  const shareAsPDF = async () => {
    if (!reportRef.current) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: null });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, w, h);
      const blob = pdf.output('blob');
      const canShareFiles = navigator.canShare && navigator.canShare({ files: [new File([blob], 'reporte.pdf', { type: 'application/pdf' })] });
      if (canShareFiles) { await navigator.share({ title: 'Reporte FlowFin', files: [new File([blob], 'reporte.pdf', { type: 'application/pdf' })] }); }
      else { pdf.save('reporte_flowfin.pdf'); }
    } finally { setSharing(false); }
  };

  const shareAsPublicCard = async () => {
    if (snapshotBusy) return;
    setSnapshotBusy(true);
    try {
      const monthLabel = format(parseISO(dateTo), 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase());
      const incomeTotal = filtered
        .filter(t => t.type === 'income')
        .reduce((s, t) => s + (t.amount || 0), 0);
      const expenseTotal = filtered
        .filter(t => t.type === 'expense')
        .reduce((s, t) => s + (t.amount || 0), 0);
      const byCategory = new Map();
      filtered.filter(t => t.type === 'expense').forEach(t => {
        const cat = categories.find(c => c.id === t.category_id);
        const label = cat ? `${cat.icon || ''} ${cat.name}`.trim() : 'Sin categoría';
        byCategory.set(label, (byCategory.get(label) || 0) + (t.amount || 0));
      });
      const topCategories = Array.from(byCategory.entries())
        .map(([label, amount]) => ({ label, amount: Math.round(amount) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4);

      const { slug } = await createSnapshot({
        type: 'monthly_report',
        payload: {
          month_label: monthLabel,
          total_income: Math.round(incomeTotal),
          total_expense: Math.round(expenseTotal),
          currency: currency || 'MXN',
          top_categories: topCategories,
        },
        ttl_days: 60,
      });
      await shareSnapshot({
        slug,
        type: 'monthly_report',
        title: 'Mi mes en FlowFin',
        message: `Así llevamos ${monthLabel} en casa.`,
      });
      setSnapshotShared(true);
      setTimeout(() => setSnapshotShared(false), 2000);
    } catch (err) {
      track('snapshot_create_failed', { type: 'monthly_report', reason: err?.message || 'unknown' });
    } finally {
      setSnapshotBusy(false);
    }
  };

  const shareAsPNG = async () => {
    if (!reportRef.current) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: null });
      await new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          const canShareFiles = navigator.canShare && navigator.canShare({ files: [new File([blob], 'reporte.png', { type: 'image/png' })] });
          if (canShareFiles) { await navigator.share({ title: 'Reporte FlowFin', files: [new File([blob], 'reporte.png', { type: 'image/png' })] }); }
          else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'reporte_flowfin.png'; a.click(); }
          resolve();
        }, 'image/png');
      });
    } finally { setSharing(false); }
  };

  return (
    <div className="pb-6">
      <PageHeader title="Reportes" subtitle="Análisis dinámico" />

      <div className="flex gap-2 px-4 mb-4">
        {['expense', 'income', canViewComparative && 'all'].filter(Boolean).map(t => (
          <button key={t} onClick={() => { setReportType(t); setPreset(0); setUserPref('report_type', t); setUserPref('report_preset', 0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${reportType === t ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground'}`}>
            {t === 'expense' ? '💸 Egresos' : t === 'income' ? '💰 Ingresos' : '⚖️ Comparativa'}
          </button>
        ))}
        {canViewTrends && (
          <button onClick={() => { setReportType('expense'); setPreset(activePresets.findIndex(p => p.rows === 'month')); }}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all bg-muted text-muted-foreground">
            📈 Tendencias
          </button>
        )}
      </div>

      <div className="flex gap-2 px-4 mb-4 overflow-x-auto hide-scrollbar">
        {activePresets.map((p, i) => (
          <button key={i} onClick={() => { setPreset(i); setUserPref('report_preset', i); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${preset === i ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {canViewFilter && (
        <div className="flex gap-2 px-4 mb-4">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
      )}

      {canViewFilter && (
        <div className="flex gap-2 px-4 mb-4">
          <div className="flex-1">
            <Select value={filterCategory || '__all__'} onValueChange={v => setFilterCategory(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-full h-9 text-sm rounded-xl border-border bg-card"><SelectValue placeholder="Todas las categorías" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las categorías</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={filterPerson || '__all__'} onValueChange={v => setFilterPerson(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-full h-9 text-sm rounded-xl border-border bg-card"><SelectValue placeholder="Todas las personas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las personas</SelectItem>
                {persons.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div ref={reportRef} className="px-4 space-y-4 bg-background">
        {canViewChart && (
          <ReportChart tableData={tableData} cfg={cfg} categories={categories} persons={persons}
            paymentMethods={paymentMethods} formatVal={formatVal} onSelectDetail={setSelectedDetail} />
        )}
        {canViewBreakdown && tableData.length > 0 ? (
          <ReportBreakdown tableData={tableData} cfg={cfg} totalVal={totalVal} filtered={filtered}
            formatVal={formatVal} categories={categories} persons={persons} paymentMethods={paymentMethods} onSelectDetail={setSelectedDetail} />
        ) : !canViewChart ? null : (
          <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">Sin datos para el período seleccionado</p>
          </div>
        )}
      </div>

      <div className="flex gap-3 px-4 mt-4">
        {(canExportPDF || canShare) && (
          <button onClick={shareAsPDF} disabled={sharing} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors shadow-sm">
            <Share2 className="w-4 h-4" /> Compartir PDF
          </button>
        )}
        {canExportImage && (
          <button onClick={shareAsPNG} disabled={sharing} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-muted text-foreground text-sm font-semibold disabled:opacity-50 hover:bg-muted/70 transition-colors">
            <Download className="w-4 h-4" /> PNG
          </button>
        )}
      </div>

      {canShare && filtered.length > 0 && (
        <div className="px-4 mt-3">
          <button
            type="button"
            onClick={shareAsPublicCard}
            disabled={snapshotBusy}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-primary/30 bg-primary/5 text-primary text-sm font-semibold disabled:opacity-50 hover:bg-primary/10 transition-colors"
          >
            {snapshotBusy
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : snapshotShared
                ? <Check className="w-4 h-4" />
                : <Sparkles className="w-4 h-4" />}
            {snapshotShared ? 'Compartido' : snapshotBusy ? 'Generando…' : 'Compartir como tarjeta pública'}
          </button>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">Anonimiza nombres y comparte solo los totales del rango actual.</p>
        </div>
      )}

      {canViewDetail && (
        <ReportDetailSheet selectedDetail={selectedDetail} detailLabel={detailLabel} detailTransactions={detailTransactions}
          categories={categories} persons={persons} paymentMethods={paymentMethods} onClose={() => setSelectedDetail(null)} />
      )}
    </div>
  );
}