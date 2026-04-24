import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import CategoryDot from '@/components/CategoryDot';
import AmountDisplay from '@/components/AmountDisplay';
import { useT } from '@/lib/i18n/useT';

export default function DashboardRecentMovements({ recent, categories, persons }) {
  const t = useT();
  return (
    <div className="mx-4 bg-card border border-border rounded-2xl p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">{t('dashboard.recentMovements')}</h3>
        <Link to="/Transactions" aria-label={t('dashboard.viewAllAria')} className="text-xs text-primary font-medium flex items-center gap-0.5">
          {t('dashboard.viewAll')} <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{t('dashboard.noRecent')}</p>
      ) : recent.map(tx => {
        const cat = categories.find(c => c.id === tx.category_id);
        const person = persons.find(p => p.id === tx.person_id);
        return (
          <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
            <CategoryDot category={cat} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                {tx.description && tx.notes ? `${tx.description} — ${tx.notes}` : tx.description || tx.notes || cat?.name || t('common.noDescription')}
              </p>
              <p className="text-xs text-muted-foreground">{tx.date} {person && `· ${person.name}`}</p>
            </div>
            <AmountDisplay amount={tx.amount} type={tx.type} size="sm" />
          </div>
        );
      })}
    </div>
  );
}
