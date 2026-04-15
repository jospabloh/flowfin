import { PERIODS } from '@/lib/dashboardConstants';

export default function DashboardFilters({ period, setPeriod, personFilter, setPersonFilter, persons, setUserPref }) {
  return (
    <div className="flex gap-2 px-4 mb-4 overflow-x-auto hide-scrollbar">
      {PERIODS.map(p => (
        <button key={p.key}
          onClick={() => { setPeriod(p.key); setUserPref('dashboard_period', p.key); }}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
            ${period === p.key ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
          {p.label}
        </button>
      ))}
      <div className="w-px h-5 bg-border self-center mx-1" />
      <button
        onClick={() => { setPersonFilter('all'); setUserPref('dashboard_person', 'all'); }}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
          ${personFilter === 'all' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>
        Todos
      </button>
      {persons.map(p => (
        <button key={p.id}
          onClick={() => { setPersonFilter(p.id); setUserPref('dashboard_person', p.id); }}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
            ${personFilter === p.id ? 'text-white shadow-sm' : 'bg-muted text-muted-foreground'}`}
          style={personFilter === p.id ? { backgroundColor: p.color } : {}}>
          {p.name}
        </button>
      ))}
    </div>
  );
}