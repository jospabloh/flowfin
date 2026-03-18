import { useEffect, useRef, useState } from 'react';

/**
 * Pull-to-refresh hook. Attaches to the main scroll container (#main-scroll).
 * Does NOT block natural scrolling — uses passive listeners.
 */
export function usePullToRefresh(onRefresh) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const el = document.getElementById('main-scroll');
    if (!el) return;

    let startY = null;
    let pullY = 0;
    const THRESHOLD = 65;

    const onTouchStart = (e) => {
      if (el.scrollTop <= 0) startY = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) pullY = Math.min(dy * 0.4, THRESHOLD);
    };

    const onTouchEnd = async () => {
      if (startY === null) return;
      startY = null;
      if (pullY >= THRESHOLD) {
        pullY = 0;
        setRefreshing(true);
        await onRefreshRef.current();
        setRefreshing(false);
      } else {
        pullY = 0;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return { refreshing };
}