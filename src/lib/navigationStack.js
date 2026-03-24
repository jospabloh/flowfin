/**
 * Robust navigation stack management with browser history sync
 * Handles tab memory, scroll position persistence, and system back gestures
 */

const HISTORY_KEY = 'ff_nav_stack';
const SCROLL_KEY = 'ff_scroll_pos';

// In-memory state (primary source)
let navigationStack = [];
let scrollPositions = {};

// Initialize from sessionStorage on first load
export function initializeNavigation(initialPath) {
  try {
    const stored = sessionStorage.getItem(HISTORY_KEY);
    navigationStack = stored ? JSON.parse(stored) : [initialPath];
  } catch {
    navigationStack = [initialPath];
  }
  
  // Setup browser popstate listener (for desktop back button & browser back)
  window.addEventListener('popstate', handlePopState);
  
  // Setup Android hardware back button interception
  // Use beforeunload to prevent default Android back behavior
  document.addEventListener('backbutton', handleAndroidBack, false);
  
  // Fallback: Intercept keyboard events on Android
  document.addEventListener('keydown', (e) => {
    // On Android, ESC key sometimes maps to hardware back button
    if (e.key === 'Escape') handleAndroidBack();
  }, { capture: true });
  
  return navigationStack;
}

function handleAndroidBack() {
  // Prevent default browser back behavior
  if (window.history.length > 1) {
    goBack();
  }
}

function handlePopState(event) {
  const path = event.state?.path || '/Dashboard';
  // Sync internal stack with browser history
  const currentIndex = navigationStack.indexOf(getCurrentPath());
  if (currentIndex > 0) {
    setNavigationStack(navigationStack.slice(0, currentIndex));
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

export function navigateTo(path) {
  if (path === getCurrentPath()) return;
  
  const direction = getNavigationDirection(getCurrentPath(), path);
  
  if (direction === 'backward') {
    // Going back to a page in history
    const index = navigationStack.lastIndexOf(path);
    setNavigationStack(navigationStack.slice(0, index + 1));
  } else {
    // Going forward
    setNavigationStack([...navigationStack, path]);
  }
  
  // Sync with browser history
  window.history.pushState({ path }, '', window.location.pathname);
}

export function goBack() {
  if (navigationStack.length > 1) {
    setNavigationStack(navigationStack.slice(0, -1));
    window.history.back();
  }
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