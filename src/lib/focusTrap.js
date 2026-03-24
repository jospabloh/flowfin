/**
 * Focus trap utilities for modals and overlays
 * Ensures keyboard navigation stays within modal until dismissed
 */

export function createFocusTrap(containerRef) {
  if (!containerRef?.current) return () => {};

  const container = containerRef.current;
  
  // Get all focusable elements
  const getFocusableElements = () => {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input[type="text"]:not([disabled])',
      'input[type="radio"]:not([disabled])',
      'input[type="checkbox"]:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    
    return Array.from(container.querySelectorAll(selector));
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return;

    const focusable = getFocusableElements();
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];
    const activeElement = document.activeElement;

    // Shift + Tab on first element → wrap to last
    if (e.shiftKey && activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
      return;
    }

    // Tab on last element → wrap to first
    if (!e.shiftKey && activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
      return;
    }
  };

  // Store initial focus
  const initialFocus = document.activeElement;
  
  // Focus first element
  const focusable = getFocusableElements();
  if (focusable.length > 0) {
    focusable[0].focus();
  }

  container.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
    if (initialFocus && initialFocus instanceof HTMLElement) {
      initialFocus.focus();
    }
  };
}

export function useModalFocusTrap(isOpen, containerRef) {
  if (!isOpen || !containerRef?.current) return;
  
  const cleanup = createFocusTrap(containerRef);
  
  // Cleanup on unmount or when modal closes
  return cleanup;
}