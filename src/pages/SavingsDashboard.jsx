import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import PageHeader from '@/components/PageHeader';
import { formatCurrency } from '@/lib/formatters';
import { Coins, TrendingDown, RefreshCw, Loader2 } from 'lucide-react';

export default function SavingsDashboard() {
  const { familyId, currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const fmt = (v) => formatCurrency(v, { locale, currency });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['savings_opportunities', familyId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getSavingsOpportunities', { familyId });
      return res.data;
    },
    enabled: !!familyId,
    staleTime: 10 * 60 * 1000,
  });

  const summary = data?.summary || {};
  const subscriptions = data?.forgottenSubscriptions || [];
  const opportunities = data?.nonEssentialOpportunities || [];

  return (
    <div className="pb-8">
      <PageHeader
        title="Oportunidades de ahorro"
        subtitle="Basado en los últimos 6 meses"
        action={
          <button onClick={() => refetch()} disabled={isFetching}
            className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50">
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        }
      />

      {isLoading ? (
        <div className="px-4 mt-4 space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="px-4 mt-4 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Ahorro mensual estimado</p>
              <p className="text-xl font-bold text-emerald-600">{fmt(summary.totalMonthlySavings || 0)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Ahorro anual estimado</p>
              <p className="text-xl font-bold text-emerald-600">{fmt(summary.totalAnnualSavings || 0)}</p>
            </div>
          </div>

          {/* Forgotten subscriptions */}
          {subscriptions.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <Coins className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-foreground">Suscripciones sin registrar</h3>
                <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{subscriptions.length}</span>
              </div>
              {subscriptions.map((s, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < subscriptions.length - 1 ? 'border-b border-border' : ''}`}>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.description}</p>
                    <p className="text-xs text-muted-foreground">{s.occurrences} meses · confianza {s.confidence}</p>
                  </div>
                  <p className="text-sm font-bold text-amber-600">{fmt(s.avgAmount)}/mes</p>
                </div>
              ))}
            </div>
          )}

          {/* Non-essential opportunities */}
          {opportunities.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold text-foreground">Gastos no esenciales a revisar</h3>
              </div>
              {opportunities.map((o, i) => (
                <div key={i} className={`px-4 py-3 ${i < opportunities.length - 1 ? 'border-b border-border' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-foreground">{o.categoryName}</p>
                    <p className="text-sm font-bold text-rose-600">{fmt(o.avgMonthly)}/mes</p>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.min(o.percentageOfExpenses, 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{o.percentageOfExpenses?.toFixed(1)}% del gasto total · ahorro potencial {fmt(o.potentialSavings)}/mes</p>
                </div>
              ))}
            </div>
          )}

          {subscriptions.length === 0 && opportunities.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-3">
                <Coins className="w-7 h-7 text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-foreground">Sin oportunidades detectadas</p>
              <p className="text-xs text-muted-foreground mt-1">Registra más movimientos para obtener análisis de ahorro.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}