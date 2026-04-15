import { PieChart, Pie, ResponsiveContainer, Cell } from 'recharts';
import PersonAvatar from '@/components/PersonAvatar';

export default function DashboardExpenseByPersonChart({ byPerson, currency, locale }) {
  if (byPerson.length <= 1) return null;

  return (
    <div className="mx-4 bg-card border border-border rounded-2xl p-4 mb-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3">Gasto por Persona</h3>
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 flex-shrink-0 min-h-[96px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byPerson} dataKey="value" cx="50%" cy="50%" innerRadius={22} outerRadius={38}>
                {byPerson.map((entry, i) => <Cell key={i} fill={entry.person?.color || '#94a3b8'} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2 flex-1">
          {byPerson.map((entry, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PersonAvatar person={entry.person} size="xs" />
                <span className="text-xs text-muted-foreground">{entry.name}</span>
              </div>
              <span className="text-sm font-semibold tabular-nums" style={{ color: entry.person?.color || 'hsl(var(--expense))' }}>
                {new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0 }).format(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}