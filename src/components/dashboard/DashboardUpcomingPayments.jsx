import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import AmountDisplay from '@/components/AmountDisplay';
import { useT } from '@/lib/i18n/useT';
import { useQuickSettings } from '@/lib/QuickSettingsContext';

export default function DashboardUpcomingPayments({ upcoming }) {
  const t = useT();
  const { lang } = useQuickSettings();
  const dateLocale = lang === 'en' ? enUS : es;

  if (!upcoming.length) return null;

  const getDayLabel = (diff) => {
    if (diff <= 0) return t('dashboard.todayMark');
    if (diff === 1) return t('dashboard.tomorrowMark');
    return t('dashboard.inDays').replace('{count}', diff);
  };

  return (
    <div className="mx-4 bg-card border border-border rounded-2xl p-4 mb-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3">{t('dashboard.upcomingPayments')}</h3>
      {upcoming.map((item, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
          <span className="text-xl">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {format(item.date, 'dd MMM', { locale: dateLocale })} · {getDayLabel(item.diff)}
            </p>
          </div>
          {item.amount && <AmountDisplay amount={item.amount} type="expense" size="sm" showSign={false} />}
        </div>
      ))}
    </div>
  );
}
