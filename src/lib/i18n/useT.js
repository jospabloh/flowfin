import { useQuickSettings } from '@/lib/QuickSettingsContext';
import es from './es';
import en from './en';

const dictionaries = { es, en };

export function useT() {
  const { lang } = useQuickSettings();
  const dict = dictionaries[lang] || dictionaries.es;

  return function t(key) {
    const parts = key.split('.');
    let val = dict;
    for (const part of parts) {
      if (val == null) break;
      val = val[part];
    }
    if (val == null) {
      // Fallback to Spanish
      let fallback = dictionaries.es;
      for (const part of parts) {
        if (fallback == null) break;
        fallback = fallback[part];
      }
      return fallback ?? key;
    }
    return val;
  };
}
