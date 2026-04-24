import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const QuickSettingsContext = createContext(null);

export function QuickSettingsProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem('flowfin_lang') || 'es'; } catch { return 'es'; }
  });
  const [hideAmounts, setHideAmountsState] = useState(() => {
    try { return localStorage.getItem('flowfin_hide_amounts') === 'true'; } catch { return false; }
  });
  const [showQuickSettings, setShowQuickSettings] = useState(false);

  const setLang = useCallback((value) => {
    setLangState(value);
    try { localStorage.setItem('flowfin_lang', value); } catch {}
  }, []);

  const setHideAmounts = useCallback((value) => {
    setHideAmountsState(value);
    try { localStorage.setItem('flowfin_hide_amounts', String(value)); } catch {}
  }, []);

  return (
    <QuickSettingsContext.Provider value={{ lang, setLang, hideAmounts, setHideAmounts, showQuickSettings, setShowQuickSettings }}>
      {children}
    </QuickSettingsContext.Provider>
  );
}

export function useQuickSettings() {
  const ctx = useContext(QuickSettingsContext);
  if (!ctx) throw new Error('useQuickSettings must be used inside QuickSettingsProvider');
  return ctx;
}
