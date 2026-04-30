import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useActivityTracker — Silently updates last_active_at on the server.
 *
 * Rules:
 * - Only fires when the user is authenticated and has a familyId.
 * - Throttled: at most once every THROTTLE_MS per session.
 * - Also fires on first mount (page open/refresh).
 * - Never blocks the UI; errors are logged and swallowed.
 */

const THROTTLE_MS = 20 * 60 * 1000; // 20 minutes

export function useActivityTracker(familyId) {
  const lastSentRef = useRef(0);

  const sendActivity = async () => {
    const now = Date.now();
    if (now - lastSentRef.current < THROTTLE_MS) return;
    lastSentRef.current = now;
    try {
      await base44.functions.invoke('trackActivity', {});
    } catch {
      // Silently ignore — never crash the app
    }
  };

  useEffect(() => {
    if (!familyId) return;

    // Delay on mount so Dashboard's primary queries go first
    const mountTimer = setTimeout(() => sendActivity(), 2000);

    // Also fire on visibility change (user returns to tab)
    const onVisible = () => {
      if (document.visibilityState === 'visible') sendActivity();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(mountTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [familyId]);
}