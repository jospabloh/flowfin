import { useQuickSettings } from '@/lib/QuickSettingsContext';
import { formatCurrency } from '@/lib/formatters';

export function useAmount() {
  const { hideAmounts } = useQuickSettings();
  return (value, opts) => hideAmounts ? '•••' : formatCurrency(value, opts);
}
