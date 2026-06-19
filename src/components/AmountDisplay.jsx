import { useFamily } from '@/lib/FamilyContext';

export default function AmountDisplay({ amount, type = 'expense', size = 'md', showSign = true, currency: propCurrency, locale: propLocale }) {
  const { currency: ctxCurrency, familyConfig } = useFamily() || {};
  const currency = propCurrency || ctxCurrency || 'MXN';
  const locale = propLocale || familyConfig?.locale || 'es-MX';

  const isIncome = type === 'income';
  const color = isIncome ? 'text-income' : 'text-expense';
  const sign = showSign ? (isIncome ? '+' : '-') : '';

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount || 0));

  const sizes = { sm: 'text-sm font-semibold', md: 'text-base font-bold', lg: 'text-xl font-bold', xl: 'text-3xl font-black' };
  // Larger figures carry the display face for personality; small inline amounts stay in Inter.
  const isLarge = size === 'lg' || size === 'xl';
  const family = isLarge ? 'font-display tracking-tight' : '';

  return <span className={`${color} ${sizes[size]} ${family} nums-money`}>{sign}{formatted}</span>;
}