import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useActivityTracker — Silently updates last_active_at on the server.
 * Throttle is global (module-level) so re-renders/re-mounts never bypass it.
 */

const THROTTLE_MS = 60 * 60 * 1000; // 60 minutes — global across all renders
let lastSentGlobal = 0;
let pendingTimer = null;

async function sendActivity() {
  const now = Date.now();
  if (now - lastSentGlobal < THROTTLE_MS) return;
  lastSentGlobal = now;
  try {
    await base44.functions.invoke('trackActivity', {});
  } catch {
    // Silently ignore
  }
}

export function useActivityTracker(familyId) {
  useEffect(() => {
    if (!familyId) return;

    // Delay on mount so Dashboard's primary queries go first
    if (!pendingTimer) {
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        sendActivity();
      }, 5000);
    }

    // Fire on visibility change (user returns to tab)
    const onVisible = () => {
      if (document.visibilityState === 'visible') sendActivity();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [familyId]);
}