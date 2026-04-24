import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useQuickSettings } from '@/lib/QuickSettingsContext';
import { useT } from '@/lib/i18n/useT';

function MiniToggle({ checked, onChange, label }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-checked={checked}
      role="switch"
      aria-label={label}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function QuickSettingsModal() {
  const { showQuickSettings, setShowQuickSettings, lang, setLang, hideAmounts, setHideAmounts } = useQuickSettings();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useT();

  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme === 'dark' : false;
  const isEnglish = lang === 'en';

  return (
    <AnimatePresence>
      {showQuickSettings && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]"
            onClick={() => setShowQuickSettings(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400, duration: 0.2 }}
            className="fixed z-[61] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-4 pt-3.5 pb-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">{t('quickSettings.title')}</p>
            </div>

            <div className="px-2 pb-2 space-y-0.5">
              {/* Language */}
              <button
                onClick={() => setLang(isEnglish ? 'es' : 'en')}
                className="w-full flex items-center justify-between px-3 py-3.5 rounded-xl hover:bg-muted/60 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-medium text-foreground leading-tight">{t('quickSettings.language')}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">{isEnglish ? t('quickSettings.english') : t('quickSettings.spanish')}</span>
                  </span>
                </span>
                <MiniToggle checked={isEnglish} onChange={(v) => setLang(v ? 'en' : 'es')} label={t('quickSettings.language')} />
              </button>

              {/* Theme */}
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="w-full flex items-center justify-between px-3 py-3.5 rounded-xl hover:bg-muted/60 transition-colors"
              >
                <span className="flex items-center gap-3">
                  {isDark
                    ? <Moon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    : <Sun className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-medium text-foreground leading-tight">{t('quickSettings.theme')}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">{isDark ? t('quickSettings.dark') : t('quickSettings.light')}</span>
                  </span>
                </span>
                <MiniToggle checked={isDark} onChange={(v) => setTheme(v ? 'dark' : 'light')} label={t('quickSettings.theme')} />
              </button>

              {/* Hide Amounts */}
              <button
                onClick={() => setHideAmounts(!hideAmounts)}
                className="w-full flex items-center justify-between px-3 py-3.5 rounded-xl hover:bg-muted/60 transition-colors"
              >
                <span className="flex items-center gap-3">
                  {hideAmounts
                    ? <EyeOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    : <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-medium text-foreground leading-tight">{t('quickSettings.amounts')}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">{hideAmounts ? t('quickSettings.hide') : t('quickSettings.show')}</span>
                  </span>
                </span>
                <MiniToggle checked={hideAmounts} onChange={setHideAmounts} label={t('quickSettings.amounts')} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
