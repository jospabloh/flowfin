import { useState, useCallback } from 'react';

const STORAGE_KEY = 'ff_subcategory_usage_v1';

export function useUsageStats() {
  const [stats, setStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch {
      // Ignore localStorage parse/read failures and start with empty stats.
      return {};
    }
  });

  const increment = useCallback((subcategoryId) => {
    if (!subcategoryId) return;
    setStats(prev => {
      const next = { ...prev, [subcategoryId]: (prev[subcategoryId] || 0) + 1 };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {
        // Ignore localStorage write failures; hook state still updates.
      }
      return next;
    });
  }, []);

  return { stats, increment };
}
