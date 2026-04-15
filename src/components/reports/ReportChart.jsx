import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#059669','#7C3AED','#F97316','#3B82F6','#EAB308','#EC4899','#14B8A6','#F43F5E'];

export default function ReportChart({ tableData, cfg, categories, persons, paymentMethods, formatVal, onSelectDetail }) {
  if (!tableData.length) return null;

  const handleClick = (state) => {
    if (!state?.activePayload?.[0]) return;
    const clicked = state.activePayload[0].payload;
    resolveAndSelect(clicked.row);
  };

  const resolveAndSelect = (rowLabel) => {
    if (cfg.rows === 'category') {
      const c = categories.find(x => `${x.icon} ${x.name}` === rowLabel);
      onSelectDetail(c?.id);
    } else if (cfg.rows === 'person') {
      const p = persons.find(x => x.name === rowLabel);
      onSelectDetail(p?.id);
    } else if (cfg.rows === 'method') {
      const m = paymentMethods.find(x => x.name === rowLabel);
      onSelectDetail(m?.id);
    }
  };

  const isHorizontal = cfg.rows === 'category' || cfg.rows === 'method' || cfg.rows === 'person';

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-1">{cfg.label}</h3>
      {isHorizontal ? (
        <div style={{ height: Math.max(180, tableData.length * 36) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tableData} layout="vertical" margin={{ left: 0, right: 60, top: 4, bottom: 4 }} onClick={handleClick}>
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
  );
}