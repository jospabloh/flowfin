import { useState, useEffect } from 'react';

const NAV_BAR_HEIGHT = 60; // Mobile bottom nav height in px

/**
 * Returns an inline style object for bottom sheets on mobile.
 * Uses globalThis.innerHeight (works correctly on iOS Safari) instead of
 * 100dvh (unreliable when browser chrome/keyboard appears on iOS).
 * 
 * On desktop there is no bottom nav bar so we use a simpler max-height.
 */
export function useBottomSheetStyle(maxPercent = 0.92) {
  const [style, setStyle] = useState({});

  useEffect(() => {
    const compute = () => {
      if (globalThis.innerWidth >= 768) {
        // Desktop: no bottom nav, just limit height
        setStyle({ maxHeight: `${Math.round(globalThis.innerHeight * maxPercent)}px` });
      } else {
        // Mobile (iOS + Android): subtract the bottom nav bar from real viewport height
        const available = globalThis.innerHeight - NAV_BAR_HEIGHT;
        setStyle({ maxHeight: `${Math.round(available * maxPercent)}px` });
      }
    };

    compute();
    globalThis.addEventListener('resize', compute);
    // On iOS the viewport height changes when the browser bar shows/hides
    globalThis.addEventListener('orientationchange', compute);
    return () => {
      globalThis.removeEventListener('resize', compute);
      globalThis.removeEventListener('orientationchange', compute);
    };
  }, [maxPercent]);

  return style;
}
