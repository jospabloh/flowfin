import { useState, useEffect, useMemo } from 'react';
import { X, Calendar, MapPin, Plane, Wallet, Tag, TrendingDown, AlertTriangle, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { computeTripSpent } from '@/lib/tripBudget';

const COLORS = ['#059669', '#D4AF37', '#0284C7', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#BE185D'];

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">{children}</h3>
    </div>
  );
}

function PersonAvatars({ ids, persons }) {
  const matched = (ids || []).map(id => persons.find(p => p.id === id)).filter(Boolean);
  return (
    <div className="flex -space-x-2">
      {matched.slice(0, 6).map(p => (
        <div key={p.id} title={p.name}
          className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white ring-2 ring-card flex-shrink-0 text-xs"
          style={{ backgroundColor: p.color || '#059669' }}
        >
          {(p.avatar_initial || p.name?.[0] || '?').toUpperCase()}
        </div>
      ))}
      {matched.length > 6 && (
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground ring-2 ring-card text-xs">
          +{matched.length - 6}
        </div>
      )}
    </div>
  );
}

// Audit: flags missing category or payment method
function auditIssues(t, categories, paymentMethods) {
  const issues = [];
  if (!t.category_id || !categories.find(c => c.id === t.category_id)) issues.push('Sin rubro');
  if (!t.payment_method_id || !paymentMethods.find(m => m.id === t.payment_method_id)) issues.push('Sin forma de pago');
  return issues;
}

export default function TripDetailModal({ trip, transactions: propTransactions, persons = [], onClose, onTripUpdated }) {
  const { currency: familyCurrency, familyConfig, familyId } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const { currentUser } = useFamily();

  const [transactions, setTransactions] = useState(propTransactions?.filter(t => t.trip_id === trip.id) || []);
  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [CloseModal, setCloseModal] = useState(null);
  // Audit edit state
  const [editingTx, setEditingTx] = useState(null);
  const [EditModal, setEditModal] = useState(null);

  const reload = () => {
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
  };

  useEffect(() => { reload(); }, [familyId, trip.id]);

  // Open edit modal lazy-loaded
  const handleEdit = async (t) => {
    setEditingTx(t);
    if (!EditModal) {
      const mod = await import('@/components/TransactionEditModal');
      setEditModal(() => mod.default);
    }
  };

  const expenses = useMemo(() => transactions.filter(t => t.type === 'expense'), [transactions]);
  const totalMXN = useMemo(() => expenses.reduce((s, t) => s + (t.amount || 0), 0), [expenses]);

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
      const amt = (t.original_currency && t.original_currency !== familyCurrency)
        ? (t.original_amount || t.amount || 0)
        : (t.amount || 0);
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
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
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

  // Group by date for timeline
  const groupedByDate = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => b.date?.localeCompare(a.date));
    const groups = {};
    for (const t of sorted) {
      const d = t.date || 'Sin fecha';
      if (!groups[d]) groups[d] = [];
      groups[d].push(t);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  // Audit summary
  const auditCount = useMemo(() =>
    expenses.filter(t => auditIssues(t, categories, paymentMethods).length > 0).length,
    [expenses, categories, paymentMethods]
  );

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

  const sorted = useMemo(() => [...transactions].sort((a, b) => b.date?.localeCompare(a.date)), [transactions]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4">
        <div className="bg-card rounded-t-3xl sm:rounded-3xl border border-border w-full max-w-2xl shadow-2xl max-h-[94vh] flex flex-col">

          {/* ── Header ── */}
          <div className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-black text-foreground text-xl">{trip.name}</h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                    trip.status === 'closed'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                  }`}>
                    {trip.status === 'closed' ? 'Cerrado' : 'Activo'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground flex-wrap">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{formatDate(trip.start_date, { locale })} — {formatDate(trip.end_date, { locale })}</span>
                  {trip.status !== 'closed' && (
                    <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                      daysRemaining <= 0
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                        : daysRemaining <= 2
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700'
                          : 'bg-primary/10 text-primary'
                    }`}>
                      {daysRemaining > 1 ? `${daysRemaining} días restantes` : daysRemaining === 1 ? 'Último día' : 'Terminado'}
                    </span>
                  )}
                </div>
                {trip.destination_countries?.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {trip.destination_countries.map(c => (
                      <span key={c} className="flex items-center gap-1 px-2.5 py-0.5 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 rounded-full text-[10px] font-semibold">
                        <MapPin className="w-2.5 h-2.5" />{c}
                      </span>
                    ))}
                  </div>
                )}
                {trip.participant_person_ids?.length > 0 && (
                  <div className="mt-2.5">
                    <PersonAvatars ids={trip.participant_person_ids} persons={persons} />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {isCreator && trip.status !== 'closed' && (
                  <button onClick={handleCloseTrip}
                    className="px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors border border-border">
                    Cerrar Viaje
                  </button>
                )}
                <button onClick={onClose} className="p-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="overflow-y-auto flex-1 px-5 py-5 space-y-6 hide-scrollbar">

            {/* ── Audit Banner ── */}
            {!loading && auditCount > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-2xl">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                    {auditCount} gasto{auditCount !== 1 ? 's' : ''} incompleto{auditCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    Toca el ícono ✏️ en cada gasto para asignar rubro o forma de pago.
                  </p>
                </div>
              </div>
            )}

            {/* ── Budget ── */}
            {trip.budget_amount > 0 && (
              <div>
                <SectionTitle icon={TrendingDown}>Presupuesto</SectionTitle>
                <div className="bg-muted/60 rounded-2xl p-4 space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Gastado</p>
                      <p className="font-black text-foreground text-lg leading-tight">
                        {formatCurrency(spentInBudgetCur, { locale, currency: budgetCur, decimals: 2 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Presupuesto</p>
                      <p className="font-bold text-muted-foreground text-base">
                        {formatCurrency(trip.budget_amount, { locale, currency: budgetCur, decimals: 0 })}
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-background rounded-full h-2.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${budgetColor}`} style={{ width: `${budgetPct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{budgetPct.toFixed(0)}% utilizado</span>
                    {trip.status !== 'closed' && (
                      <span>{daysRemaining > 0 ? `${daysRemaining} días restantes` : 'Viaje terminado'}</span>
                    )}
                  </div>
                  {unconvertedCount > 0 && (
                    <p className="text-[11px] text-amber-500 bg-amber-500/10 rounded-lg px-2 py-1">
                      ⚠️ {unconvertedCount} gasto{unconvertedCount !== 1 ? 's' : ''} sin tipo de cambio no incluidos
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── By Currency ── */}
            {byCurrency.length > 0 && (
              <div>
                <SectionTitle icon={Wallet}>Por Moneda</SectionTitle>
                <div className="space-y-2">
                  {byCurrency.map(({ currency: cur, total }) => (
                    <div key={cur} className="flex items-center justify-between px-4 py-3 bg-muted/60 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-md">{cur}</span>
                        <span className="text-xs text-muted-foreground">
                          {cur !== familyCurrency ? 'Monto original' : 'Moneda local'}
                        </span>
                      </div>
                      <span className="font-bold text-foreground">
                        {formatCurrency(total, { locale, currency: cur, decimals: 2 })}
                      </span>
                    </div>
                  ))}
                  {expenses.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
                      <span className="text-sm font-bold text-primary">Total en {familyCurrency}</span>
                      <span className="font-black text-foreground text-base">
                        {formatCurrency(totalMXN, { locale, currency: familyCurrency, decimals: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── By Payment Method ── */}
            {byPaymentMethod.length > 0 && (
              <div>
                <SectionTitle icon={Wallet}>Por Forma de Pago</SectionTitle>
                <div className="rounded-2xl bg-muted/40 p-3 space-y-2.5">
                  {byPaymentMethod.map(({ name, value }, i) => {
                    const pct = totalMXN > 0 ? (value / totalMXN) * 100 : 0;
                    const isMissing = name === 'Sin especificar';
                    return (
                      <div key={name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: isMissing ? '#D97706' : COLORS[i % COLORS.length] }} />
                            <span className={`font-medium ${isMissing ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>{name}</span>
                            {isMissing && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                            <span className="font-bold text-foreground">{formatCurrency(value, { locale, currency: familyCurrency, decimals: 0 })}</span>
                          </div>
                        </div>
                        <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: isMissing ? '#D97706' : COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── By Category ── */}
            {byCategory.length > 0 && (
              <div>
                <SectionTitle icon={Tag}>Por Rubro</SectionTitle>
                <div className="space-y-2">
                  {byCategory.map(({ name, value }, _i) => {
                    const pct = totalMXN > 0 ? (value / totalMXN) * 100 : 0;
                    const isMissing = name === 'Sin rubro';
                    return (
                      <div key={name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-medium ${isMissing ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>{name}</span>
                            {isMissing && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                            <span className="font-bold text-foreground">{formatCurrency(value, { locale, currency: familyCurrency, decimals: 0 })}</span>
                          </div>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: isMissing ? '#D97706' : '#059669' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Transaction Timeline grouped by day ── */}
            {groupedByDate.length > 0 && (
              <div>
                <SectionTitle icon={Calendar}>Gastos del Viaje</SectionTitle>
                <div className="space-y-4">
                  {groupedByDate.map(([date, txs]) => {
                    const dayTotal = txs.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
                    return (
                      <div key={date}>
                        {/* Day header */}
                        <div className="flex items-center justify-between mb-2 px-1">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                            {date !== 'Sin fecha' ? formatDate(date, { locale, style: 'medium' }) : 'Sin fecha'}
                          </p>
                          <p className="text-xs font-bold text-expense">
                            -{formatCurrency(dayTotal, { locale, currency: familyCurrency, decimals: 0 })}
                          </p>
                        </div>
                        {/* Transactions */}
                        <div className="space-y-1.5">
                          {txs.map(t => {
                            const cat = categories.find(c => c.id === t.category_id);
                            const pm = paymentMethods.find(m => m.id === t.payment_method_id);
                            const hasForeign = t.original_currency && t.original_currency !== familyCurrency;
                            const issues = auditIssues(t, categories, paymentMethods);
                            const hasIssues = issues.length > 0;

                            return (
                              <div key={t.id}
                                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-colors ${
                                  hasIssues
                                    ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800'
                                    : 'bg-muted/60 hover:bg-muted'
                                }`}
                              >
                                {/* Icon */}
                                <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-base flex-shrink-0 shadow-sm">
                                  {cat?.icon || '📋'}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-semibold text-foreground truncate">
                                      {t.description || cat?.name || '—'}
                                    </p>
                                    {/* Audit badges */}
                                    {issues.map(issue => (
                                      <span key={issue}
                                        className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md text-[9px] font-bold flex-shrink-0">
                                        <AlertTriangle className="w-2.5 h-2.5" />{issue}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                    {cat && (
                                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                                        {cat.icon} {cat.name}
                                      </span>
                                    )}
                                    {pm && (
                                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                                        💳 {pm.name}
                                      </span>
                                    )}
                                    {t.is_split && (
                                      <span className="text-[10px] text-sky-600 bg-sky-100 dark:bg-sky-900/30 px-1.5 py-0.5 rounded-md">👥 Split</span>
                                    )}
                                  </div>
                                  {/* Foreign currency detail */}
                                  {hasForeign && (
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                                      {formatCurrency(t.original_amount || t.amount, { locale, currency: t.original_currency, decimals: 2 })}
                                      {t.exchange_rate
                                        ? ` × ${Number(t.exchange_rate).toFixed(4)} = ${formatCurrency(t.amount, { locale, currency: familyCurrency, decimals: 2 })}`
                                        : ' (sin TC)'}
                                    </p>
                                  )}
                                </div>

                                {/* Amount + edit button */}
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  <p className={`font-bold text-sm ${t.type === 'expense' ? 'text-expense' : 'text-income'}`}>
                                    {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount, { locale, currency: familyCurrency, decimals: 2 })}
                                  </p>
                                  {hasForeign && (
                                    <p className="text-[10px] font-mono text-muted-foreground">{t.original_currency}</p>
                                  )}
                                  {/* Edit button — always visible, highlighted when audit issues exist */}
                                  <button
                                    onClick={() => handleEdit(t)}
                                    title="Editar gasto"
                                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                                      hasIssues
                                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                                        : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-border'
                                    }`}
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                    {hasIssues ? 'Completar' : 'Editar'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {groupedByDate.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Plane className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">Sin gastos registrados</p>
                <p className="text-xs text-muted-foreground mt-1">Registra un gasto y asígnalo a este viaje.</p>
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close Trip Modal */}
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

      {/* Inline Edit Modal for audit fix */}
      {editingTx && EditModal && (
        <EditModal
          transaction={editingTx}
          categories={categories}
          subcategories={[]}
          persons={persons}
          paymentMethods={paymentMethods}
          onClose={() => setEditingTx(null)}
          onSaved={() => {
            setEditingTx(null);
            reload();
            onTripUpdated?.();
          }}
        />
      )}
    </>
  );
}