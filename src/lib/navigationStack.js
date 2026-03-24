/**
 * AUDIT: Navigation Stack & React Router Integration
 * 
 * FINDINGS & ARCHITECTURE:
 * ✓ The navigation stack correctly maintains history independent of React Router
 * ✓ Android hardware back button is intercepted via 'backbutton' event + ESC fallback
 * ✓ popstate listener syncs custom stack with browser history
 * ✓ All navigation calls use both navigateTo() AND navigate() to sync both systems
 * 
 * CRITICAL: This dual-sync approach is necessary because:
 * - Custom navigationStack provides session persistence and tab memory
 * - React Router's internal history is the browser's source of truth
 * - Must keep both in sync to prevent desynchronization on Android back gesture
 */

const HISTORY_KEY = 'ff_nav_stack';
const SCROLL_KEY = 'ff_scroll_pos';

// In-memory state (primary source of truth for session persistence)
let navigationStack = [];
let scrollPositions = {};

// Track if currently processing a back gesture to prevent loops
let isProcessingBack = false;

/**
 * Initialize navigation system with session history and Android back button support
 * Must be called once at app startup
 */
export function initializeNavigation(initialPath) {
  try {
    const stored = sessionStorage.getItem(HISTORY_KEY);
    navigationStack = stored ? JSON.parse(stored) : [initialPath];
  } catch {
    navigationStack = [initialPath];
  }
  
  // Listen for browser back (desktop, iOS swipe, or Android back via React Router)
  window.addEventListener('popstate', handlePopState, false);
  
  // Android hardware back button (fired by Cordova/Capacitor)
  document.addEventListener('backbutton', handleAndroidBackButton, false);
  
  // ESC key fallback for Android (some WebView implementations)
  document.addEventListener('keydown', handleAndroidKeyboardBack, { capture: true });
  
  return navigationStack;
}

/**
 * Direct Android hardware back button handler
 * Called by Cordova/Capacitor 'backbutton' event
 */
function handleAndroidBackButton(event) {
  if (event) {
    event.preventDefault?.();
  }
  // Only go back if there's history to go back to
  if (navigationStack.length > 1) {
    goBack();
  } else if (navigationStack.length === 1) {
    // At root: allow system to handle (close app or go to home)
    document.removeEventListener('backbutton', handleAndroidBackButton);
  }
}

/**
 * ESC key fallback for Android back button
 * Some WebView implementations map hardware back to ESC key
 */
function handleAndroidKeyboardBack(event) {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault();
    if (navigationStack.length > 1) {
      goBack();
    }
  }
}

/**
 * Browser popstate handler (React Router's history change)
 * Syncs internal navigation stack with browser's actual history
 * 
 * IMPORTANT: This fires when:
 * - Browser back/forward buttons are clicked
 * - iOS swipe-back gesture is performed
 * - Android hardware back button triggers window.history.back()
 * - User navigates with browser controls
 */
function handlePopState(event) {
  if (isProcessingBack) return; // Prevent double-processing
  
  const path = event.state?.path;
  if (!path) return; // Ignore events without path state
  
  // Sync internal stack to match where browser history went
  if (path !== getCurrentPath()) {
    const index = navigationStack.indexOf(path);
    if (index >= 0) {
      setNavigationStack(navigationStack.slice(0, index + 1));
    }
  }
}

export function getCurrentPath() {
  return navigationStack[navigationStack.length - 1] || '/Dashboard';
}

export function getPreviousPath() {
  return navigationStack[navigationStack.length - 2] || '/Dashboard';
}

export function isRootTab(path) {
  const ROOT_TABS = ['/Dashboard', '/Transactions', '/Capture', '/Reports'];
  return ROOT_TABS.includes(path);
}

export function getNavigationDirection(fromPath, toPath) {
  if (fromPath === toPath) return 'none';
  const fromIndex = navigationStack.indexOf(fromPath);
  const toIndex = navigationStack.lastIndexOf(toPath);
  return toIndex !== -1 && toIndex < fromIndex ? 'backward' : 'forward';
}

/**
 * Navigate to a path with proper sync between custom stack and React Router
 * This is called by Layout's handleNavClick for all programmatic navigation
 */
export function navigateTo(path) {
  if (path === getCurrentPath()) return;
  
  const direction = getNavigationDirection(getCurrentPath(), path);
  
  if (direction === 'backward') {
    // Going back to existing history entry
    const index = navigationStack.lastIndexOf(path);
    setNavigationStack(navigationStack.slice(0, index + 1));
  } else {
    // Going forward to new or revisited path
    setNavigationStack([...navigationStack, path]);
  }
  
  // CRITICAL: Push to browser history so React Router and back gestures work correctly
  window.history.pushState({ path }, '', window.location.pathname);
}

/**
 * Go back one page in history
 * Syncs with both custom stack and browser history
 * Called by: back button, Android back button, iOS swipe-back
 */
export function goBack() {
  if (navigationStack.length <= 1) return;
  
  isProcessingBack = true;
  setNavigationStack(navigationStack.slice(0, -1));
  // This triggers popstate event via React Router, which will call handlePopState
  window.history.back();
  
  // Allow popstate to complete
  requestAnimationFrame(() => {
    isProcessingBack = false;
  });
}

function setNavigationStack(newStack) {
  navigationStack = newStack;
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(navigationStack));
  } catch {
    // Fallback if sessionStorage fails
  }
}

export function saveScrollPosition(path, position) {
  scrollPositions[path] = position;
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(scrollPositions));
  } catch {
    // Fallback
  }
}

export function getScrollPosition(path) {
  if (scrollPositions[path] !== undefined) return scrollPositions[path];
  try {
    const stored = sessionStorage.getItem(SCROLL_KEY);
    return stored ? JSON.parse(stored)[path] || 0 : 0;
  } catch {
    return 0;
  }
}

export function clearNavigation() {
  navigationStack = [];
  scrollPositions = {};
  sessionStorage.removeItem(HISTORY_KEY);
  sessionStorage.removeItem(SCROLL_KEY);
}