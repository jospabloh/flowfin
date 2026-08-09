import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency } from '@/lib/formatters';
import PageHeader from '@/components/PageHeader';
import { PiggyBank, TrendingDown, RefreshCw, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useCanView } from '@/lib/permissions/usePermission';
import CategoryBudgetConfig from '@/components/budget/CategoryBudgetConfig';

const MONTHS_OPTIONS = [
  { value: 1, label: 'Último mes' },
  { value: 3, label: 'Últimos 3 meses' },
  { value: 6, label: 'Últimos 6 meses' },
];

export default function Budget() {
  const { familyId, currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const [months, setMonths] = useState(3);

  const canViewCards = useCanView('budget.view.cards');
  const canViewChart = useCanView('budget.view.chart');
  const canViewPeriodSelector = useCanView('budget.view.period_selector');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['budget_suggestion', familyId, months],
    queryFn: async () => {
      const res = await base44.functions.invoke('analytics', { action: 'getBudgetSuggestion', familyId, months });
      return res.data;
    },
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
  });

  const fmt = (v) => formatCurrency(v, { locale, currency });
  const suggestions = data?.suggestions || [];
  const coverage = data?.avg_monthly_income > 0
    ? Math.round((data.total_suggested_budget / data.avg_monthly_income) * 100)
    : null;

  return (
    <div className="pb-8">
      <PageHeader
        title="Presupuesto"
        subtitle="Sugerencia basada en tu historial"
        action={
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center justify-center p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors touch-target">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      <div className="px-4 space-y-4">
        {/* Period selector */}
        {canViewPeriodSelector && (
          <div className="flex gap-2">
            {MONTHS_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setMonths(opt.value)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all
                  ${months === opt.value ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-2xl">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            El presupuesto sugerido se calcula con base en el promedio mensual de tus egresos
            de los {months === 1 ? 'último mes' : `últimos ${months} meses`}, más un margen del 10%.
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-2xl">
            <PiggyBank className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">Sin datos suficientes</p>
            <p className="text-xs text-muted-foreground mt-1">Registra movimientos para generar sugerencias</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            {canViewCards && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-expense" />
                    <span className="text-xs text-muted-foreground">Presupuesto sugerido</span>
                  </div>
                  <p className="text-lg font-black text-expense tabular-nums">{fmt(data?.total_suggested_budget)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">/ mes</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <PiggyBank className="w-4 h-4 text-income" />
                    <span className="text-xs text-muted-foreground">Ingreso prom. mensual</span>
                  </div>
                  <p className="text-lg font-black text-income tabular-nums">{fmt(data?.avg_monthly_income)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">/ mes</p>
                </div>
              </div>
            )}

            {/* Coverage indicator */}
            {coverage !== null && (
              <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
                coverage <= 80 ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' :
                coverage <= 100 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700' :
                'bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700'
              }`}>
                <span className="text-2xl">{coverage <= 80 ? '🟢' : coverage <= 100 ? '🟡' : '🔴'}</span>
                <div>
                  <p className={`text-sm font-bold ${
                    coverage <= 80 ? 'text-income' :
                    coverage <= 100 ? 'text-amber-800 dark:text-amber-300' :
                    'text-expense'
                  }`}>
                    {coverage <= 80 ? 'Finanzas saludables' : coverage <= 100 ? 'Presupuesto ajustado' : 'Egresos superan ingresos'}
                  </p>
                  <p className={`text-xs ${
                    coverage <= 80 ? 'text-income/70' :
                    coverage <= 100 ? 'text-amber-700 dark:text-amber-400' :
                    'text-expense/70'
                  }`}>
                    El presupuesto sugerido representa el {coverage}% de tus ingresos
                  </p>
                </div>
              </div>
            )}

            {/* Bar chart */}
            {canViewChart && suggestions.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-3">Distribución por rubro</h3>
                <div style={{ height: Math.min(suggestions.length * 32 + 20, 300) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={suggestions} layout="vertical" margin={{ left: 0, right: 40 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="category_name" width={90} tick={{ fontSize: 10, fill: 'currentColor' }} />
                      <Tooltip
                        formatter={(v) => [fmt(v), 'Presupuesto sugerido']}
                        labelStyle={{ fontSize: 11 }}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="suggested_budget" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 9, formatter: v => fmt(v) }}>
                        {suggestions.map((entry, i) => (
                          <Cell key={i} fill={entry.category_color || '#059669'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Detail list */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Detalle por categoría</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Basado en {data?.expense_count} transacciones</p>
              </div>
              {suggestions.map((s, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < suggestions.length - 1 ? 'border-b border-border' : ''}`}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ backgroundColor: `${s.category_color}20` }}>
                    {s.category_icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.category_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Promedio: {fmt(s.avg_monthly)}/mes · {s.months_with_data} mes{s.months_with_data > 1 ? 'es' : ''} con datos
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-foreground tabular-nums">{fmt(s.suggested_budget)}</p>
                    <p className="text-[10px] text-muted-foreground">sugerido</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Budget limits configuration — always visible */}
        <CategoryBudgetConfig />
      </div>
    </div>
  );
}