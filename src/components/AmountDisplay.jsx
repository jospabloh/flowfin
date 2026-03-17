export default function AmountDisplay({ amount, type = 'expense', size = 'md', showSign = true }) {
  const isIncome = type === 'income';
  const color = isIncome ? 'text-income' : 'text-expense';
  const sign = showSign ? (isIncome ? '+' : '-') : '';
  const formatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Math.abs(amount || 0));

  const sizes = { sm: 'text-sm font-semibold', md: 'text-base font-bold', lg: 'text-xl font-bold', xl: 'text-3xl font-black' };

  return <span className={`${color} ${sizes[size]} tabular-nums`}>{sign}{formatted}</span>;
}