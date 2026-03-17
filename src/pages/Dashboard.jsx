import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, TrendingUp, TrendingDown, Wallet, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import PageHeader from '@/components/PageHeader';
import AmountDisplay from '@/components/AmountDisplay';
import PersonAvatar from '@/components/PersonAvatar';
import CategoryDot from '@/components/CategoryDot';
import { useCatalog } from '@/hooks/useCatalog';
import { useFamily } from '@/lib/FamilyContext';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const PERIODS = [
  { label: 'Hoy', key: 'today' },
  { label: 'Ayer', key: 'yesterday' },
  { label: 'Semana', key: 'week' },
  { label: 'Mes', key: 'month' },
];

function getRange(key) {
  const now = new Date();
  if (key === 'today') return { start: new Date(now.setHours(0,0,0,0)), end: new Date() };
  if (key === 'yesterday') { const d = subDays(new Date(), 1); return { start: new Date(d.setHours(0,0,0,0)), end: new Date(d.setHours(23,59,59,999)) }; }
  if (key === 'week') return { start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) };
  return { start: startOfMonth(new Date()), end: endOfMonth(new Date()) };
}

export default function Dashboard() {
  const [period, setPeriod] = useState('month');
  const [personFilter, setPersonFilter] = useState('all');
  const { familyId } = useFamily();
  const { categories, persons } = useCatalog(familyId);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', familyId],
    queryFn: () => base44.entities.Transaction.filter({ family_id: familyId }, '-date', 500),
    enabled: !!familyId,
  });

  const { data: investments = [] } = useQuery({ queryKey: ['investments', familyId], queryFn: () => base44.entities.Investment.filter({ family_id: familyId }), enabled: !!familyId });
  const { data: investmentPayments = [] } = useQuery({ queryKey: ['investmentPayments'], queryFn: () => base44.entities.InvestmentPayment.list() });
  const { data: msiList = [] } = useQuery({ queryKey: ['msi', familyId], queryFn: () => base44.entities.MSI.filter({ family_id: familyId }), enabled: !!familyId });
  const { data: msiPayments = [] } = useQuery({ queryKey: ['msiPayments'], queryFn: () => base44.entities.MSIPayment.list() });

  const range = getRange(period);

  const filtered = useMemo(() => transactions.filter(t => {
    if (!t.date) return false;
    const d = parseISO(t.date);
    const inRange = isWithinInterval(d, { start: range.start, end: range.end });
    const inPerson = personFilter === 'all' || t.person_id === personFilter;
    return inRange && inPerson;
  }), [transactions, period, personFilter, range.start, range.end]);

  const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const balance = income - expense;

  const topCategories = useMemo(() => {
    const map = {};
    filtered.filter(t => t.type === 'expense').forEach(t => {
      const key = t.category_id || 'sin-cat';
      map[key] = (map[key] || 0) + (t.amount || 0);
    });
    return Object.entries(map)
      .map(([id, total]) => ({ cat: categories.find(c => c.id === id), total }))
      .sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filtered, categories]);

  const byPerson = useMemo(() => {
    const map = {};
    filtered.filter(t => t.type === 'expense').forEach(t => {
      const key = t.person_id || 'sin-persona';
      map[key] = (map[key] || 0) + (t.amount || 0);
    });
    return Object.entries(map).map(([id, value]) => ({
      person: persons.find(p => p.id === id),
      value, name: persons.find(p => p.id === id)?.name || 'Sin asignar'
    }));
  }, [filtered, persons]);

  const upcoming = useMemo(() => {
    const items = [];
    const today = new Date();
    investments.filter(i => i.is_active !== false).forEach(inv => {
      const paid = investmentPayments.filter(p => p.investment_id === inv.id).length;
      if (paid < inv.total_payments) {
        const next = new Date(inv.start_date);
        next.setMonth(next.getMonth() + paid);
        if (inv.payment_day) next.setDate(inv.payment_day);
        const diff = Math.ceil((next - today) / 86400000);
        items.push({ type: 'investment', name: inv.name, amount: inv.payment_amount, date: next, diff, icon: '📈' });
      }
    });
    msiList.filter(m => m.is_active !== false).forEach(msi => {
      const paid = msiPayments.filter(p => p.msi_id === msi.id).length;
      if (paid < msi.total_months) {
        const next = new Date(msi.start_date);
        next.setMonth(next.getMonth() + paid);
        if (msi.billing_day) next.setDate(msi.billing_day);
        const diff = Math.ceil((next - today) / 86400000);
        items.push({ type: 'msi', name: msi.store, amount: msi.monthly_amount, date: next, diff, icon: '💳' });
      }
    });
    return items.sort((a, b) => a.diff - b.diff).slice(0, 4);
  }, [investments, investmentPayments, msiList, msiPayments]);

  const recent = transactions.slice(0, 5);

  return (
    <div className="pb-4">
      <PageHeader
        title={format(new Date(), "MMMM yyyy", { locale: es }).replace(/^\w/, c => c.toUpperCase())}
        subtitle="Resumen familiar"
      />

      {/* Period filter */}
      <div className="flex gap-2 px-4 mb-4 overflow-x-auto hide-scrollbar">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
              ${period === p.key ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            {p.label}
          </button>
        ))}
        <div className="w-px h-5 bg-border self-center mx-1" />
        <button onClick={() => setPersonFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
            ${personFilter === 'all' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>
          Todos
        </button>
        {persons.map(p => (
          <button key={p.id} onClick={() => setPersonFilter(p.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
              ${personFilter === p.id ? 'text-white shadow-sm' : 'bg-muted text-muted-foreground'}`}
            style={personFilter === p.id ? { backgroundColor: p.color } : {}}>
            {p.name}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 px-4 mb-4">
        {[
          { label: 'Ingresos', amount: income, type: 'income', icon: TrendingUp },
          { label: 'Egresos', amount: expense, type: 'expense', icon: TrendingDown },
          { label: 'Balance', amount: Math.abs(balance), type: balance >= 0 ? 'income' : 'expense', icon: Wallet },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card border border-border rounded-2xl p-3 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${card.type === 'income' ? 'text-income' : 'text-expense'}`} />
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              <AmountDisplay amount={card.amount} type={card.type} size="sm" showSign={false} />
            </div>
          );
        })}
      </div>

      {/* Top categories bar */}
      {topCategories.length > 0 && (
        <div className="mx-4 bg-card border border-border rounded-2xl p-4 mb-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top Categorías</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCategories} layout="vertical" margin={{ left: 0, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="cat.name" width={80} tick={{ fontSize: 10, fill: 'currentColor' }} />
                <Tooltip formatter={v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(v)} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {topCategories.map((entry, i) => <Cell key={i} fill={entry.cat?.color || '#059669'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* By person pie */}
      {byPerson.length > 1 && (
        <div className="mx-4 bg-card border border-border rounded-2xl p-4 mb-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Gasto por Persona</h3>
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 flex-shrink-0">
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
                  <AmountDisplay amount={entry.value} type="expense" size="sm" showSign={false} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="mx-4 bg-card border border-border rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Últimos movimientos</h3>
          <Link to="/Transactions" className="text-xs text-primary font-medium flex items-center gap-0.5">
            Ver todos <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Sin movimientos aún</p>
        ) : recent.map(t => {
          const cat = categories.find(c => c.id === t.category_id);
          const person = persons.find(p => p.id === t.person_id);
          return (
            <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
              <CategoryDot category={cat} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.description || cat?.name || 'Sin descripción'}</p>
                <p className="text-xs text-muted-foreground">{t.date} {person && `· ${person.name}`}</p>
              </div>
              <AmountDisplay amount={t.amount} type={t.type} size="sm" />
            </div>
          );
        })}
      </div>

      {/* Upcoming payments */}
      {upcoming.length > 0 && (
        <div className="mx-4 bg-card border border-border rounded-2xl p-4 mb-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Próximos pagos</h3>
          {upcoming.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
              <span className="text-xl">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{format(item.date, 'dd MMM', { locale: es })} · {item.diff <= 0 ? '¡Hoy!' : item.diff === 1 ? 'Mañana' : `En ${item.diff} días`}</p>
              </div>
              {item.amount && <AmountDisplay amount={item.amount} type="expense" size="sm" showSign={false} />}
            </div>
          ))}
        </div>
      )}

      {/* FAB mobile */}
      <div className="md:hidden fixed bottom-24 right-4 z-30">
        <Link to="/Capture"
          className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform">
          <Plus className="w-6 h-6" />
        </Link>
      </div>
    </div>
  );
}