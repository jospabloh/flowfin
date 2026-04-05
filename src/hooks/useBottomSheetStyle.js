import { useState, useEffect } from 'react';

const NAV_BAR_HEIGHT = 60; // Mobile bottom nav height in px

/**
 * Returns an inline style object for bottom sheets on mobile.
 * Uses window.innerHeight (works correctly on iOS Safari) instead of
 * 100dvh (unreliable when browser chrome/keyboard appears on iOS).
 * 
 * On desktop there is no bottom nav bar so we use a simpler max-height.
 */
export function useBottomSheetStyle(maxPercent = 0.92) {
  const [style, setStyle] = useState({});

  useEffect(() => {
    const isMobile = window.innerWidth < 768;

    const compute = () => {
      if (window.innerWidth >= 768) {
        // Desktop: no bottom nav, just limit height
        setStyle({ maxHeight: `${Math.round(window.innerHeight * maxPercent)}px` });
      } else {
        // Mobile (iOS + Android): subtract the bottom nav bar from real viewport height
        const available = window.innerHeight - NAV_BAR_HEIGHT;
        setStyle({ maxHeight: `${Math.round(available * maxPercent)}px` });
      }
    };

    compute();
    window.addEventListener('resize', compute);
    // On iOS the viewport height changes when the browser bar shows/hides
    window.addEventListener('orientationchange', compute);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
    };
  }, [maxPercent]);

  return style;
}