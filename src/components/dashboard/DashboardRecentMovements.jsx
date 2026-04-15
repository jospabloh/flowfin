import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import CategoryDot from '@/components/CategoryDot';
import AmountDisplay from '@/components/AmountDisplay';

export default function DashboardRecentMovements({ recent, categories, persons }) {
  return (
    <div className="mx-4 bg-card border border-border rounded-2xl p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Últimos movimientos</h3>
        <Link to="/Transactions" aria-label="Ver todos los movimientos recientes" className="text-xs text-primary font-medium flex items-center gap-0.5">
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
              <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                {t.description && t.notes ? `${t.description} — ${t.notes}` : t.description || t.notes || cat?.name || 'Sin descripción'}
              </p>
              <p className="text-xs text-muted-foreground">{t.date} {person && `· ${person.name}`}</p>
            </div>
            <AmountDisplay amount={t.amount} type={t.type} size="sm" />
          </div>
        );
      })}
    </div>
  );
}