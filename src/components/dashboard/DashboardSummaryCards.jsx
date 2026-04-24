import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import AmountDisplay from '@/components/AmountDisplay';
import { useT } from '@/lib/i18n/useT';

export default function DashboardSummaryCards({ income, expense, balance }) {
  const t = useT();
  const cards = [
    { label: t('dashboard.income'), amount: income, type: 'income', icon: TrendingUp, link: '/Reports?type=income' },
    { label: t('dashboard.expense'), amount: expense, type: 'expense', icon: TrendingDown, link: '/Reports?type=expense' },
    { label: t('dashboard.balance'), amount: Math.abs(balance), type: balance >= 0 ? 'income' : 'expense', icon: Wallet, link: null },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 px-4 mb-4">
      {cards.map(card => {
        const Icon = card.icon;
        const content = (
          <>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon className={`w-3.5 h-3.5 ${card.type === 'income' ? 'text-income' : 'text-expense'}`} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <AmountDisplay amount={card.amount} type={card.type} size="sm" showSign={false} />
          </>
        );
        return card.link ? (
          <Link key={card.label} to={card.link} className="bg-card border border-border rounded-2xl p-3 shadow-sm hover:border-primary/40 transition-colors">
            {content}
          </Link>
        ) : (
          <div key={card.label} className="bg-card border border-border rounded-2xl p-3 shadow-sm">
            {content}
          </div>
        );
      })}
    </div>
  );
}
