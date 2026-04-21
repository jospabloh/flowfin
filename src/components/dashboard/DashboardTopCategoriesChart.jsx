import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import AmountDisplay from '@/components/AmountDisplay';
import { formatCurrency } from '@/lib/formatters';

export default function DashboardTopCategoriesChart({ topCategories, expense, currency, locale }) {
  if (!topCategories.length) return null;

  return (
    <div className="mx-4 bg-card border border-border rounded-2xl p-4 mb-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-1">Top Categorías</h3>
      <p className="text-xs text-muted-foreground mb-3">Top 5 de {topCategories.length} categorías</p>
      <div className="h-36 min-h-[144px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={topCategories} layout="vertical" margin={{ left: 0, right: 8 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="cat.name" width={80} tick={{ fontSize: 10, fill: 'currentColor' }} />
            <Tooltip formatter={v => formatCurrency(v, { locale, currency })} />
            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
              {topCategories.map((entry, i) => <Cell key={i} fill={entry.cat?.color || '#059669'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Total egresos</span>
        <AmountDisplay amount={expense} type="expense" size="sm" showSign={false} />
      </div>
    </div>
  );
}