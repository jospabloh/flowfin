/**
 * Tab-Scoped Navigation Stack Architecture
 * 
 * MULTI-TAB HISTORY PATTERN:
 * Each primary bottom-tab maintains an independent navigation stack,
 * scroll position cache, and history buffer. This mimics native iOS/Android
 * behavior where each tab has its own navigation history.
 * 
 * PRIMARY TABS (root views):
 * - /Dashboard (home)
 * - /Transactions (list)
 * - /Capture (plus/create)
 * - /Reports (analytics)
 * 
 * SUB-PAGES: Any non-primary route pushes onto the CURRENT TAB's stack.
 * 
 * SYNC STRATEGY:
 * - Dual-sync with React Router (pushState/popstate)
 * - Active tab stack drives all navigation
 * - When switching tabs, save active stack & restore target tab's stack
 * - Scroll positions are per-page, not per-tab
 */

const HISTORY_KEY = 'ff_nav_stacks';
const SCROLL_KEY = 'ff_scroll_pos';
const ACTIVE_TAB_KEY = 'ff_active_tab';

// Primary tab routes (bottom navigation)
const PRIMARY_TABS = ['/Dashboard', '/Transactions', '/Capture', '/Reports'];

// Per-tab stacks: { [tabPath]: [page, page, ...] }
let tabStacks = {};
let scrollPositions = {};
let activeTab = '/Dashboard';

// Track if currently processing a back gesture to prevent loops
let isProcessingBack = false;

/**
 * Get the primary tab for any given path
 * e.g., /Reports -> /Reports, /Reports/Detail -> /Reports
 */
function getTabForPath(path) {
  const tab = PRIMARY_TABS.find(t => path === t || path.startsWith(t + '/'));
  return tab || '/Dashboard';
}

/**
 * Initialize multi-tab navigation system
 * Call once at app startup, passing initial route
 */
export function initializeNavigation(initialPath) {
  try {
    const stored = sessionStorage.getItem(HISTORY_KEY);
    if (stored) {
      tabStacks = JSON.parse(stored);
    } else {
      // Initialize with empty stacks for all primary tabs
      PRIMARY_TABS.forEach(tab => {
        tabStacks[tab] = [tab]; // Each tab starts with itself
      });
    }
  } catch {
    PRIMARY_TABS.forEach(tab => {
      tabStacks[tab] = [tab];
    });
  }
  
  // Restore active tab
  try {
    const storedTab = sessionStorage.getItem(ACTIVE_TAB_KEY);
    activeTab = storedTab && PRIMARY_TABS.includes(storedTab) ? storedTab : '/Dashboard';
  } catch {
    activeTab = '/Dashboard';
  }
  
  // Restore scroll positions
  try {
    const storedScroll = sessionStorage.getItem(SCROLL_KEY);
    if (storedScroll) {
      scrollPositions = JSON.parse(storedScroll);
    }
  } catch {
    // Fallback
  }
  
  // Browser history listeners
  window.addEventListener('popstate', handlePopState, false);
  
  // Android hardware back button (Cordova/Capacitor)
  document.addEventListener('backbutton', handleAndroidBackButton, false);
  
  // ESC key fallback for Android WebView
  document.addEventListener('keydown', handleAndroidKeyboardBack, { capture: true });
  
  return getActiveTabStack();
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
  if (getActiveTabStack().length > 1) {
    goBack();
  } else {
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
    if (getActiveTabStack().length > 1) {
      goBack();
    }
  }
}

/**
 * Handle browser popstate (React Router history change)
 * Syncs tab-scoped stack with browser history
 */
function handlePopState(event) {
  if (isProcessingBack) return; // Prevent double-processing
  
  const path = event.state?.path;
  if (!path) return;
  
  // Detect if switching to a different primary tab
  const targetTab = getTabForPath(path);
  if (targetTab !== activeTab && PRIMARY_TABS.includes(targetTab)) {
    switchTab(targetTab, path);
  } else {
    // Same tab: sync the stack to match where browser went
    const currentStack = getActiveTabStack();
    const index = currentStack.indexOf(path);
    if (index >= 0) {
      setActiveTabStack(currentStack.slice(0, index + 1));
    }
  }
}

/**
 * Get current path in active tab's stack
 */
export function getCurrentPath() {
  const stack = getActiveTabStack();
  return stack[stack.length - 1] || activeTab;
}

/**
 * Get previous path in active tab's stack
 */
export function getPreviousPath() {
  const stack = getActiveTabStack();
  return stack[stack.length - 2] || activeTab;
}

/**
 * Check if path is a primary tab (root of navigation)
 */
export function isRootTab(path) {
  return PRIMARY_TABS.includes(path);
}

/**
 * Get the current active tab
 */
export function getActiveTab() {
  return activeTab;
}

/**
 * Get the navigation stack for the active tab
 */
function getActiveTabStack() {
  if (!tabStacks[activeTab]) {
    tabStacks[activeTab] = [activeTab];
  }
  return tabStacks[activeTab];
}

/**
 * Update the active tab's stack
 */
function setActiveTabStack(newStack) {
  tabStacks[activeTab] = newStack;
  persistTabStacks();
}

/**
 * Switch to a different primary tab
 * Saves current tab's stack and restores target tab's stack
 */
function switchTab(newTab, initialPath = null) {
  // Ensure tabs are initialized
  if (!tabStacks[activeTab]) tabStacks[activeTab] = [activeTab];
  if (!tabStacks[newTab]) tabStacks[newTab] = [newTab];
  
  // Switch active tab
  activeTab = newTab;
  
  // If initialPath is provided and not already in stack, add it
  if (initialPath && !tabStacks[newTab].includes(initialPath)) {
    tabStacks[newTab].push(initialPath);
  }
  
  persistTabStacks();
  persistActiveTab();
}

/**
 * Determine navigation direction within active tab's stack
 */
export function getNavigationDirection(fromPath, toPath) {
  if (fromPath === toPath) return 'none';
  const stack = getActiveTabStack();
  const fromIndex = stack.indexOf(fromPath);
  const toIndex = stack.lastIndexOf(toPath);
  return toIndex !== -1 && toIndex < fromIndex ? 'backward' : 'forward';
}

/**
 * Navigate to a path with tab-aware stack management
 * Handles tab switching and intra-tab navigation
 */
export function navigateTo(path) {
  if (path === getCurrentPath()) return;
  
  const targetTab = getTabForPath(path);
  const currentTab = activeTab;
  
  // Tab switch: save current, switch, then navigate within new tab
  if (targetTab !== currentTab && PRIMARY_TABS.includes(targetTab)) {
    switchTab(targetTab);
    if (path !== targetTab) {
      // Add sub-path to the tab's stack
      const newStack = [...getActiveTabStack(), path];
      setActiveTabStack(newStack);
    }
  } else {
    // Same tab: check if going back or forward
    const direction = getNavigationDirection(getCurrentPath(), path);
    const currentStack = getActiveTabStack();
    
    if (direction === 'backward') {
      // Going back to existing entry in this tab's history
      const index = currentStack.lastIndexOf(path);
      setActiveTabStack(currentStack.slice(0, index + 1));
    } else {
      // Going forward within this tab
      setActiveTabStack([...currentStack, path]);
    }
  }
  
  // Sync with browser history
  window.history.pushState({ path }, '', window.location.pathname);
}

/**
 * Go back one step in active tab's history
 * If at root of tab, doesn't go back (system can close app)
 */
export function goBack() {
  const stack = getActiveTabStack();
  if (stack.length <= 1) return;
  
  isProcessingBack = true;
  setActiveTabStack(stack.slice(0, -1));
  // Triggers popstate via React Router
  window.history.back();
  
  requestAnimationFrame(() => {
    isProcessingBack = false;
  });
}

/**
 * Persist all tab stacks to sessionStorage
 */
function persistTabStacks() {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(tabStacks));
  } catch {
    // Fallback if sessionStorage fails
  }
}

/**
 * Persist active tab to sessionStorage
 */
function persistActiveTab() {
  try {
    sessionStorage.setItem(ACTIVE_TAB_KEY, activeTab);
  } catch {
    // Fallback
  }
}

/**
 * Save scroll position for a path
 * Scroll positions are global, not per-tab
 */
export function saveScrollPosition(path, position) {
  scrollPositions[path] = position;
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(scrollPositions));
  } catch {
    // Fallback
  }
}

/**
 * Retrieve scroll position for a path
 */
export function getScrollPosition(path) {
  if (scrollPositions[path] !== undefined) return scrollPositions[path];
  try {
    const stored = sessionStorage.getItem(SCROLL_KEY);
    return stored ? JSON.parse(stored)[path] || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Clear all navigation state
 * Useful for logout or hard reset
 */
export function clearNavigation() {
  tabStacks = {};
  scrollPositions = {};
  activeTab = '/Dashboard';
  sessionStorage.removeItem(HISTORY_KEY);
  sessionStorage.removeItem(SCROLL_KEY);
  sessionStorage.removeItem(ACTIVE_TAB_KEY);
}