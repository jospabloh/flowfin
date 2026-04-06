import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Share2, Download, X } from 'lucide-react';
import { useMemory } from '@/hooks/useMemory';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import PageHeader from '@/components/PageHeader';
import { useCatalog } from '@/hooks/useCatalog';
import { useFamily } from '@/lib/FamilyContext';
import AmountDisplay from '@/components/AmountDisplay';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { endOfMonth, subMonths, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

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

const COLORS = ['#059669','#7C3AED','#F97316','#3B82F6','#EAB308','#EC4899','#14B8A6','#F43F5E'];

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

  const cfg = PRESETS[reportType][preset];

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
      if (cfg.rows === 'category') {
        const c = categories.find(x => x.id === t.category_id);
        rowKey = c ? `${c.icon} ${c.name}` : 'Sin categoría';
      } else if (cfg.rows === 'person') {
        rowKey = persons.find(p => p.id === t.person_id)?.name || 'Sin persona';
      } else if (cfg.rows === 'month') {
        rowKey = t.date?.slice(0, 7) || 'Sin fecha';
      } else if (cfg.rows === 'method') {
        rowKey = paymentMethods.find(m => m.id === t.payment_method_id)?.name || 'Sin forma';
      }
      if (!map[rowKey]) map[rowKey] = { row: rowKey, total: 0, count: 0, items: [] };
      map[rowKey].total += t.amount || 0;
      map[rowKey].count++;
      map[rowKey].items.push(t.amount || 0);
    });
    return Object.values(map)
      .map(r => ({
        ...r,
        value: cfg.metric === 'sum' ? r.total : cfg.metric === 'avg' ? r.total / r.count : r.count
      }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, cfg, categories, persons, paymentMethods]);

  const formatVal = (v) => cfg.metric === 'count' ? v :
    new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);

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
    if (cfg.rows === 'category') {
      const c = categories.find(x => x.id === selectedDetail);
      return c ? `${c.icon} ${c.name}` : 'Sin categoría';
    }
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
      if (canShareFiles) {
        await navigator.share({ title: 'Reporte FlowFin', files: [new File([blob], 'reporte.pdf', { type: 'application/pdf' })] });
      } else {
        pdf.save('reporte_flowfin.pdf');
      }
    } finally {
      setSharing(false);
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
          if (canShareFiles) {
            await navigator.share({ title: 'Reporte FlowFin', files: [new File([blob], 'reporte.png', { type: 'image/png' })] });
          } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'reporte_flowfin.png';
            a.click();
          }
          resolve();
        }, 'image/png');
      });
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="pb-6">
      <PageHeader title="Reportes" subtitle="Análisis dinámico" />

      {/* Type selector */}
      <div className="flex gap-2 px-4 mb-4">
        {['expense', 'income', 'all'].map(t => (
          <button key={t} onClick={() => { setReportType(t); setPreset(0); setUserPref('report_type', t); setUserPref('report_preset', 0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all
              ${reportType === t ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground'}`}>
            {t === 'expense' ? '💸 Egresos' : t === 'income' ? '💰 Ingresos' : '⚖️ Comparativa'}
          </button>
        ))}
      </div>

      {/* Presets */}
      <div className="flex gap-2 px-4 mb-4 overflow-x-auto hide-scrollbar">
        {PRESETS[reportType].map((p, i) => (
          <button key={i} onClick={() => { setPreset(i); setUserPref('report_preset', i); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
              ${preset === i ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Date range */}
      <div className="flex gap-2 px-4 mb-4">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Desde</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Hasta</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-4 mb-4">
        <div className="flex-1">
          <Select value={filterCategory || '__all__'} onValueChange={v => setFilterCategory(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-full h-9 text-sm rounded-xl border-border bg-card">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las categorías</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Select value={filterPerson || '__all__'} onValueChange={v => setFilterPerson(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-full h-9 text-sm rounded-xl border-border bg-card">
              <SelectValue placeholder="Todas las personas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las personas</SelectItem>
              {persons.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div ref={reportRef} className="px-4 space-y-4 bg-background">
        {/* Chart */}
        {tableData.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-1">{cfg.label}</h3>
            <p className="text-xs text-muted-foreground mb-3">{dateFrom} → {dateTo}</p>
            {cfg.rows === 'category' || cfg.rows === 'method' || cfg.rows === 'person' ? (
              <div>
                {/* Horizontal bar chart — much more readable than pie with many categories */}
                <div style={{ height: Math.max(180, tableData.length * 36) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tableData} layout="vertical" margin={{ left: 0, right: 60, top: 4, bottom: 4 }}
                      onClick={(state) => {
                        if (!state?.activePayload?.[0]) return;
                        const clicked = state.activePayload[0].payload;
                        if (cfg.rows === 'category') {
                          const c = categories.find(x => `${x.icon} ${x.name}` === clicked.row);
                          setSelectedDetail(c?.id);
                        } else if (cfg.rows === 'person') {
                          const p = persons.find(x => x.name === clicked.row);
                          setSelectedDetail(p?.id);
                        } else if (cfg.rows === 'method') {
                          const m = paymentMethods.find(x => x.name === clicked.row);
                          setSelectedDetail(m?.id);
                        }
                      }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="row" width={130} tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={formatVal} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} style={{ cursor: 'pointer' }}
                        label={{ position: 'right', fontSize: 10, formatter: formatVal, fill: 'currentColor' }}>
                        {tableData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tableData} margin={{ bottom: 20 }}>
                    <XAxis dataKey="row" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={formatVal} />
                    <Bar dataKey="value" radius={[4,4,0,0]}>
                      {tableData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Analytics detail */}
        {tableData.length > 0 && (
          <div className="space-y-3">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-card border border-border rounded-2xl p-3 text-center shadow-sm">
                <p className="text-[10px] text-muted-foreground mb-1">Total</p>
                <p className="text-sm font-bold text-foreground">{formatVal(totalVal)}</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-3 text-center shadow-sm">
                <p className="text-[10px] text-muted-foreground mb-1">Movimientos</p>
                <p className="text-sm font-bold text-foreground">{filtered.length}</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-3 text-center shadow-sm">
                <p className="text-[10px] text-muted-foreground mb-1">Promedio</p>
                <p className="text-sm font-bold text-foreground">{filtered.length > 0 ? formatVal(totalVal / filtered.length) : '—'}</p>
              </div>
            </div>

            {/* Ranked detail with % bar */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border flex justify-between items-center">
                <span className="text-sm font-semibold text-foreground">Desglose</span>
                <span className="text-xs text-muted-foreground">{tableData.length} {cfg.rows === 'category' ? 'rubros' : cfg.rows === 'person' ? 'personas' : cfg.rows === 'method' ? 'formas de pago' : 'meses'}</span>
              </div>
              {tableData.map((row, i) => {
                const pct = totalVal > 0 ? (row.value / totalVal) * 100 : 0;
                const avg = row.count > 0 ? row.value / row.count : 0;
                return (
                  <button key={i} onClick={() => {
                    if (cfg.rows === 'category') {
                      const c = categories.find(x => `${x.icon} ${x.name}` === row.row);
                      setSelectedDetail(c?.id);
                    } else if (cfg.rows === 'person') {
                      const p = persons.find(x => x.name === row.row);
                      setSelectedDetail(p?.id);
                    } else if (cfg.rows === 'method') {
                      const m = paymentMethods.find(x => x.name === row.row);
                      setSelectedDetail(m?.id);
                    } else if (cfg.rows === 'month') {
                      setSelectedDetail(row.row.split(' · ')[0]);
                    }
                  }} className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors ${i < tableData.length - 1 ? 'border-b border-border' : ''}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="flex-1 text-sm font-medium text-foreground truncate">{row.row}</span>
                      <span className="text-sm font-bold text-foreground">{formatVal(row.value)}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="ml-4 h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                    <div className="ml-4 flex gap-3 text-[10px] text-muted-foreground">
                      <span>{pct.toFixed(1)}% del total</span>
                      <span>·</span>
                      <span>{row.count} mov.</span>
                      <span>·</span>
                      <span>Prom. {formatVal(avg)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {tableData.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">Sin datos para el período seleccionado</p>
          </div>
        )}
      </div>

      {/* Share buttons */}
      <div className="flex gap-3 px-4 mt-4">
        <button onClick={shareAsPDF} disabled={sharing}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors shadow-sm">
          <Share2 className="w-4 h-4" /> Compartir PDF
        </button>
        <button onClick={shareAsPNG} disabled={sharing}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-muted text-foreground text-sm font-semibold disabled:opacity-50 hover:bg-muted/70 transition-colors">
          <Download className="w-4 h-4" /> PNG
        </button>
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedDetail && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50" onClick={() => setSelectedDetail(null)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border max-h-[85vh] overflow-y-auto pb-safe">
              <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
                <div>
                  <h3 className="font-bold text-foreground text-base">{detailLabel}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{detailTransactions.length} transacciones</p>
                </div>
                <button onClick={() => setSelectedDetail(null)} className="p-2 rounded-xl bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                {detailTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin transacciones</p>
                ) : detailTransactions.map(t => {
                  const cat = categories.find(c => c.id === t.category_id);
                  const person = persons.find(p => p.id === t.person_id);
                  const method = paymentMethods.find(m => m.id === t.payment_method_id);
                  return (
                    <div key={t.id} className="bg-muted rounded-2xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{t.description || 'Sin descripción'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(parseISO(t.date), 'dd MMM yyyy', { locale: es })}
                          </p>
                        </div>
                        <AmountDisplay amount={t.amount} type={t.type} size="sm" />
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {cat && <span className="text-[10px] bg-background px-2 py-1 rounded-full text-foreground">{cat.icon} {cat.name}</span>}
                        {person && <span className="text-[10px] bg-background px-2 py-1 rounded-full text-foreground">{person.name}</span>}
                        {method && <span className="text-[10px] bg-background px-2 py-1 rounded-full text-foreground">{method.name}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}