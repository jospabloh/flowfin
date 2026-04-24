import { SlidersHorizontal } from 'lucide-react';
import { useQuickSettings } from '@/lib/QuickSettingsContext';
import { useT } from '@/lib/i18n/useT';

export default function QuickSettingsTrigger({ size = 'default' }) {
  const { setShowQuickSettings } = useQuickSettings();
  const t = useT();

  // Sidebar: full-width row matching ThemeToggle showLabel style
  if (size === 'sidebar') {
    return (
      <button
        onClick={() => setShowQuickSettings(true)}
        aria-label={t('quickSettings.title')}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
      >
        <SlidersHorizontal className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        {t('quickSettings.title')}
      </button>
    );
  }

  // Mobile top bar: compact icon button matching ChevronLeft style
  return (
    <button
      onClick={() => setShowQuickSettings(true)}
      aria-label={t('quickSettings.title')}
      className="flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all touch-target"
    >
      <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}
