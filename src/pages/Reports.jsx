import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Share2, Download } from 'lucide-react';
import { useMemory } from '@/hooks/useMemory';
import PageHeader from '@/components/PageHeader';
import { useCatalog } from '@/hooks/useCatalog';
import { useFamily } from '@/lib/FamilyContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { endOfMonth, subMonths, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import ReportChart from '@/components/reports/ReportChart';
import ReportBreakdown from '@/components/reports/ReportBreakdown';
import ReportDetailSheet from '@/components/reports/ReportDetailSheet';

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

  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type');
  const [reportType, setReportType] = useState(typeParam === 'income' ? 'income' : typeParam === 'all' ? 'all' : (getUserPref('report_type', 'expense')));
  const [preset, setPreset] = useState(() => getUserPref('report_preset', 0));
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 2), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [sharing, setSharing] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPerson, setFilterPerson] = useState('');
  const [selectedDetail, setSelectedDetail] = useState(null);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions_reports', familyId],
    queryFn: () => base44.entities.Transaction.filter({ family_id: familyId }, '-date', 2000),
    enabled: !!familyId,
  });

  const cfg = PRESETS[reportType][preset] || PRESETS[reportType][0];

  const filtered = useMemo(() => (Array.isArray(transactions) ? transactions : []).filter(t => {
    if (!t.date) return false;
    if (cfg.type !== 'all' && t.type !== cfg.type) return false;
    if (filterCategory && t.category_id !== filterCategory) return false;
    if (filterPerson && t.person_id !== filterPerson) return false;
    return t.date >= dateFrom && t.date <= dateTo;
  }), [transactions, cfg, dateFrom, dateTo, filterCategory, filterPerson]);

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

  const formatVal = (v) => cfg.metric === 'count' ? v : new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);
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
        {['expense', 'income', 'all'].map(t => (
          <button key={t} onClick={() => { setReportType(t); setPreset(0); setUserPref('report_type', t); setUserPref('report_preset', 0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${reportType === t ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground'}`}>
            {t === 'expense' ? '💸 Egresos' : t === 'income' ? '💰 Ingresos' : '⚖️ Comparativa'}
          </button>
        ))}
      </div>

      <div className="flex gap-2 px-4 mb-4 overflow-x-auto hide-scrollbar">
        {PRESETS[reportType].map((p, i) => (
          <button key={i} onClick={() => { setPreset(i); setUserPref('report_preset', i); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${preset === i ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground'}`}>
            {p.label}
          </button>
        ))}
      </div>

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

      <div ref={reportRef} className="px-4 space-y-4 bg-background">
        <ReportChart tableData={tableData} cfg={cfg} categories={categories} persons={persons}
          paymentMethods={paymentMethods} formatVal={formatVal} onSelectDetail={setSelectedDetail} />
        {tableData.length > 0 ? (
          <ReportBreakdown tableData={tableData} cfg={cfg} totalVal={totalVal} filtered={filtered}
            formatVal={formatVal} categories={categories} persons={persons} paymentMethods={paymentMethods} onSelectDetail={setSelectedDetail} />
        ) : (
          <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">Sin datos para el período seleccionado</p>
          </div>
        )}
      </div>

      <div className="flex gap-3 px-4 mt-4">
        <button onClick={shareAsPDF} disabled={sharing} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors shadow-sm">
          <Share2 className="w-4 h-4" /> Compartir PDF
        </button>
        <button onClick={shareAsPNG} disabled={sharing} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-muted text-foreground text-sm font-semibold disabled:opacity-50 hover:bg-muted/70 transition-colors">
          <Download className="w-4 h-4" /> PNG
        </button>
      </div>

      <ReportDetailSheet selectedDetail={selectedDetail} detailLabel={detailLabel} detailTransactions={detailTransactions}
        categories={categories} persons={persons} paymentMethods={paymentMethods} onClose={() => setSelectedDetail(null)} />
    </div>
  );
}