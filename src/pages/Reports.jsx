import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Share2, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import PageHeader from '@/components/PageHeader';
import { useCatalog } from '@/hooks/useCatalog';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  const { categories, persons, paymentMethods } = useCatalog();

  // Read ?type= param to auto-select preset
  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type'); // 'income' | 'expense'
  const initialPreset = typeParam === 'income' ? 2 : 0; // 'income' → Evolución Mensual (all), 'expense' → Gastos por Categoría
  const [preset, setPreset] = useState(initialPreset);
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 2), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [sharing, setSharing] = useState(false);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-date', 2000),
  });

  const cfg = PRESETS[preset];

  const filtered = useMemo(() => transactions.filter(t => {
    if (!t.date) return false;
    if (cfg.type !== 'all' && t.type !== cfg.type) return false;
    return t.date >= dateFrom && t.date <= dateTo;
  }), [transactions, cfg, dateFrom, dateTo]);

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
        value: cfg.metric === 'sum' ? r.total
          : cfg.metric === 'avg' ? r.total / r.count
          : r.count
      }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, cfg, categories, persons, paymentMethods]);

  const formatVal = (v) => cfg.metric === 'count' ? v :
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(v);

  const totalVal = tableData.reduce((s, r) => s + r.value, 0);

  const shareAsPDF = async () => {
    if (!reportRef.current) return;
    setSharing(true);
    const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, w, h);
    const blob = pdf.output('blob');
    if (navigator.share) {
      await navigator.share({ title: 'Reporte FamilyFlow', files: [new File([blob], 'reporte.pdf', { type: 'application/pdf' })] });
    } else {
      pdf.save('reporte_familyflow.pdf');
    }
    setSharing(false);
  };

  const shareAsPNG = async () => {
    if (!reportRef.current) return;
    setSharing(true);
    const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
    canvas.toBlob(async (blob) => {
      if (navigator.share) {
        await navigator.share({ title: 'Reporte FamilyFlow', files: [new File([blob], 'reporte.png', { type: 'image/png' })] });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'reporte_familyflow.png';
        a.click();
      }
      setSharing(false);
    });
  };

  return (
    <div className="pb-6">
      <PageHeader title="Reportes" subtitle="Análisis dinámico" />

      {/* Presets */}
      <div className="flex gap-2 px-4 mb-4 overflow-x-auto hide-scrollbar">
        {PRESETS.map((p, i) => (
          <button key={i} onClick={() => setPreset(i)}
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

      <div ref={reportRef} className="px-4 space-y-4 bg-background">
        {/* Chart */}
        {tableData.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-1">{PRESETS[preset].label}</h3>
            <p className="text-xs text-muted-foreground mb-3">{dateFrom} → {dateTo}</p>
            {cfg.rows === 'category' || cfg.rows === 'method' || cfg.rows === 'person' ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tableData} dataKey="value" nameKey="row" cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={2}>
                      {tableData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={formatVal} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
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

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <span className="text-sm font-semibold text-foreground">Detalle</span>
            <span className="text-sm font-bold text-foreground">{formatVal(totalVal)}</span>
          </div>
          {tableData.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Sin datos para el período seleccionado</p>
          ) : tableData.map((row, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < tableData.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="flex-1 text-sm text-foreground truncate">{row.row}</span>
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">{formatVal(row.value)}</p>
                {cfg.metric === 'sum' && <p className="text-xs text-muted-foreground">{((row.value / totalVal) * 100).toFixed(1)}%</p>}
              </div>
            </div>
          ))}
        </div>
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
    </div>
  );
}