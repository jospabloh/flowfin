import { useState, useEffect, useMemo } from 'react';
import { X, Calendar, MapPin, Plane } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { computeTripSpent } from '@/lib/tripBudget';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#1B4332', '#D4AF37', '#059669', '#0284C7', '#7C3AED', '#DC2626', '#D97706', '#0891B2'];

function SectionTitle({ children }) {
  return <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-3">{children}</h3>;
}

function PersonAvatars({ ids, persons, size = 'sm' }) {
  const matched = (ids || []).map(id => persons.find(p => p.id === id)).filter(Boolean);
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm';
  return (
    <div className="flex -space-x-2">
      {matched.slice(0, 6).map(p => (
        <div key={p.id} title={p.name}
          className={`${sz} rounded-full flex items-center justify-center font-bold text-white ring-2 ring-card flex-shrink-0`}
          style={{ backgroundColor: p.color || '#059669' }}
        >
          {(p.avatar_initial || p.name?.[0] || '?').toUpperCase()}
        </div>
      ))}
      {matched.length > 6 && (
        <div className={`${sz} rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground ring-2 ring-card`}>
          +{matched.length - 6}
        </div>
      )}
    </div>
  );
}

export default function TripDetailModal({ trip, transactions: propTransactions, persons = [], onClose, onTripUpdated }) {
  const { currency: familyCurrency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const [transactions, setTransactions] = useState(propTransactions?.filter(t => t.trip_id === trip.id) || []);
  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [CloseModal, setCloseModal] = useState(null);
  const { currentUser, familyId } = useFamily();

  useEffect(() => {
    if (!familyId) return;
    Promise.all([
      base44.entities.Transaction.filter({ family_id: familyId }),
      base44.entities.Category.filter({ family_id: familyId }),
      base44.entities.PaymentMethod.filter({ family_id: familyId }),
    ]).then(([txs, cats, pms]) => {
      setTransactions((txs || []).filter(t => t.trip_id === trip.id));
      setCategories(cats || []);
      setPaymentMethods(pms || []);
    }).finally(() => setLoading(false));
  }, [familyId, trip.id]);

  const expenses = useMemo(() => transactions.filter(t => t.type === 'expense'), [transactions]);
  const totalSpent = useMemo(() => expenses.reduce((s, t) => s + (t.amount || 0), 0), [expenses]);

  const budgetCur = trip.budget_currency || familyCurrency;
  const { spent: spentInBudgetCur, unconvertedCount } = useMemo(
    () => computeTripSpent(transactions, trip, familyCurrency),
    [transactions, trip, familyCurrency]
  );
  const budgetPct = trip.budget_amount > 0 ? Math.min((spentInBudgetCur / trip.budget_amount) * 100, 100) : 0;
  const budgetColor = budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500';

  const byCurrency = useMemo(() => {
    const map = {};
    for (const t of expenses) {
      const cur = t.original_currency || familyCurrency;
      const amt = t.original_amount || t.amount || 0;
      map[cur] = (map[cur] || 0) + amt;
    }
    return Object.entries(map).map(([currency, total]) => ({ currency, total }));
  }, [expenses, familyCurrency]);

  const byPaymentMethod = useMemo(() => {
    const map = {};
    for (const t of expenses) {
      const pm = paymentMethods.find(m => m.id === t.payment_method_id);
      const name = pm?.name || 'Sin especificar';
      map[name] = (map[name] || 0) + (t.amount || 0);
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses, paymentMethods]);

  const byCategory = useMemo(() => {
    const map = {};
    for (const t of expenses) {
      const cat = categories.find(c => c.id === t.category_id);
      const name = cat ? `${cat.icon || ''} ${cat.name}` : 'Sin rubro';
      map[name] = (map[name] || 0) + (t.amount || 0);
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [expenses, categories]);

  const sorted = useMemo(() => [...transactions].sort((a, b) => b.date?.localeCompare(a.date)), [transactions]);

  const handleCloseTrip = async () => {
    const mod = await import('@/components/trips/TripCloseModal');
    setCloseModal(() => mod.default);
    setShowCloseModal(true);
  };

  const isCreator = currentUser?.id === trip.created_by_user_id;
  const daysRemaining = (() => {
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const end = new Date(trip.end_date + 'T12:00:00');
    return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  })();

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4">
        <div className="bg-card rounded-t-3xl sm:rounded-3xl border border-border w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-foreground text-lg truncate">{trip.name}</h2>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                    trip.status === 'closed'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  }`}>
                    {trip.status === 'closed' ? 'Cerrado' : 'Activo'}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground flex-wrap">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(trip.start_date, { locale })} — {formatDate(trip.end_date, { locale })}</span>
                  {trip.status !== 'closed' && (
                    <span className="font-medium text-foreground">
                      · {daysRemaining > 1 ? `${daysRemaining} días restantes` : daysRemaining === 1 ? 'Hoy es el último día' : 'Terminado'}
                    </span>
                  )}
                </div>
                {trip.destination_countries?.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1.5">
                    {trip.destination_countries.map(c => (
                      <span key={c} className="flex items-center gap-0.5 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-medium">
                        <MapPin className="w-2.5 h-2.5" />{c}
                      </span>
                    ))}
                  </div>
                )}
                {trip.participant_person_ids?.length > 0 && (
                  <div className="mt-2">
                    <PersonAvatars ids={trip.participant_person_ids} persons={persons} />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {isCreator && trip.status !== 'closed' && (
                  <button onClick={handleCloseTrip}
                    className="px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors">
                    Cerrar Viaje
                  </button>
                )}
                <button onClick={onClose} className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
            {/* Budget Overview */}
            {trip.budget_amount > 0 && (
              <div>
                <SectionTitle>Presupuesto</SectionTitle>
                <div className="bg-muted rounded-2xl p-4 space-y-2">
                  <div className="w-full bg-background rounded-full h-3 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${budgetColor}`} style={{ width: `${budgetPct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gastado</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(spentInBudgetCur, { locale, currency: budgetCur, decimals: 0 })} / {formatCurrency(trip.budget_amount, { locale, currency: budgetCur, decimals: 0 })}
                      <span className="text-muted-foreground ml-1">({budgetPct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  {unconvertedCount > 0 && (
                    <p className="text-xs text-amber-500">
                      {unconvertedCount} {unconvertedCount === 1 ? 'gasto' : 'gastos'} sin tasa de cambio — no se incluyen en la barra
                    </p>
                  )}
                  {trip.status !== 'closed' && (
                    <p className="text-xs text-muted-foreground">
                      {daysRemaining > 0 ? `${daysRemaining} días restantes` : 'Viaje terminado'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* By Currency */}
            {byCurrency.length > 0 && (
              <div>
                <SectionTitle>Por Moneda</SectionTitle>
                <div className="space-y-2">
                  {byCurrency.map(({ currency: cur, total }) => (
                    <div key={cur} className="flex items-center justify-between px-4 py-2.5 bg-muted rounded-xl">
                      <span className="font-mono font-semibold text-sm text-muted-foreground">{cur}</span>
                      <span className="font-bold text-foreground text-sm">
                        {formatCurrency(total, { locale, currency: cur, decimals: 2 })}
                      </span>
                    </div>
                  ))}
                  {byCurrency.length > 1 && (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                      <span className="text-xs font-semibold text-muted-foreground">Total en {familyCurrency}</span>
                      <span className="font-black text-foreground">
                        {formatCurrency(totalSpent, { locale, currency: familyCurrency, decimals: 0 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* By Payment Method */}
            {byPaymentMethod.length > 0 && (
              <div>
                <SectionTitle>Por Forma de Pago</SectionTitle>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byPaymentMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {byPaymentMethod.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v, { locale, currency: familyCurrency, decimals: 0 })} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* By Category */}
            {byCategory.length > 0 && (
              <div>
                <SectionTitle>Por Rubro</SectionTitle>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byCategory} layout="vertical" margin={{ left: 8, right: 8 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                      <Tooltip formatter={(v) => formatCurrency(v, { locale, currency: familyCurrency, decimals: 0 })} />
                      <Bar dataKey="value" fill="#1B4332" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Expense Timeline */}
            {sorted.length > 0 && (
              <div>
                <SectionTitle>Gastos del Viaje</SectionTitle>
                <div className="space-y-2">
                  {sorted.map(t => {
                    const cat = categories.find(c => c.id === t.category_id);
                    const pm = paymentMethods.find(m => m.id === t.payment_method_id);
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 bg-muted rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-base flex-shrink-0">
                          {cat?.icon || '📋'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{t.description || cat?.name || '—'}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDate(t.date, { locale, style: 'short' })}
                            {pm ? ` · ${pm.name}` : ''}
                            {t.original_currency && (t.original_amount || t.amount)
                              ? ` · ${formatCurrency(t.original_amount || t.amount, { locale, currency: t.original_currency, decimals: 2 })} ${t.original_currency}`
                              : ''}
                            {t.is_split ? ' 👥' : ''}
                          </p>
                        </div>
                        <span className={`font-bold text-sm flex-shrink-0 ${t.type === 'expense' ? 'text-expense' : 'text-income'}`}>
                          {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount, { locale, currency: familyCurrency, decimals: 0 })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {sorted.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Plane className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Aún no hay gastos registrados en este viaje.</p>
                <p className="text-xs text-muted-foreground mt-1">Registra un gasto y asígnalo a este viaje.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCloseModal && CloseModal && (
        <CloseModal
          trip={trip}
          transactions={sorted}
          categories={categories}
          paymentMethods={paymentMethods}
          onClose={() => setShowCloseModal(false)}
          onClosed={() => {
            setShowCloseModal(false);
            onClose();
            onTripUpdated?.();
          }}
        />
      )}
    </>
  );
}
