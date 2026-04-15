const COLORS = ['#059669','#7C3AED','#F97316','#3B82F6','#EAB308','#EC4899','#14B8A6','#F43F5E'];

export default function ReportBreakdown({ tableData, cfg, totalVal, filtered, formatVal, categories, persons, paymentMethods, onSelectDetail }) {
  if (!tableData.length) return null;

  const resolveId = (row) => {
    if (cfg.rows === 'category') return categories.find(x => `${x.icon} ${x.name}` === row.row)?.id;
    if (cfg.rows === 'person') return persons.find(x => x.name === row.row)?.id;
    if (cfg.rows === 'method') return paymentMethods.find(x => x.name === row.row)?.id;
    if (cfg.rows === 'month') return row.row.split(' · ')[0];
    return null;
  };

  return (
    <div className="space-y-3">
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

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <span className="text-sm font-semibold text-foreground">Desglose</span>
          <span className="text-xs text-muted-foreground">{tableData.length} {cfg.rows === 'category' ? 'rubros' : cfg.rows === 'person' ? 'personas' : cfg.rows === 'method' ? 'formas de pago' : 'meses'}</span>
        </div>
        {tableData.map((row, i) => {
          const pct = totalVal > 0 ? (row.value / totalVal) * 100 : 0;
          const avg = row.count > 0 ? row.value / row.count : 0;
          return (
            <button key={i} onClick={() => onSelectDetail(resolveId(row))}
              className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors ${i < tableData.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="flex-1 text-sm font-medium text-foreground truncate">{row.row}</span>
                <span className="text-sm font-bold text-foreground">{formatVal(row.value)}</span>
              </div>
              <div className="ml-4 h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
              </div>
              <div className="ml-4 flex gap-3 text-[10px] text-muted-foreground">
                <span>{pct.toFixed(1)}% del total</span><span>·</span><span>{row.count} mov.</span><span>·</span><span>Prom. {formatVal(avg)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}