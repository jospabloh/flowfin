/**
 * Thin wrapper around posthog-js. Boots lazily on first call so the bundle
 * stays tree-shakeable when VITE_POSTHOG_KEY is unset (every method becomes
 * a no-op in that case).
 *
 * Event names follow snake_case. Keep them stable — they're the funnel
 * fingerprint we'll graph against.
 */

import posthog from 'posthog-js';

const KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let booted = false;

function ensureBoot() {
  if (booted) return true;
  if (!KEY || typeof window === 'undefined') return false;
  try {
    posthog.init(KEY, {
      api_host: HOST,
      capture_pageview: true,
      autocapture: false,
      persistence: 'localStorage',
      disable_session_recording: true,
    });
    booted = true;
    return true;
  } catch {
    return false;
  }
}

export function track(event, props = {}) {
  if (!ensureBoot()) return;
  try {
    posthog.capture(event, props);
  } catch {
    // ignore — analytics must never throw into product code
  }
}

export function identify(userId, traits = {}) {
  if (!ensureBoot()) return;
  if (!userId) return;
  try {
    posthog.identify(userId, traits);
  } catch {
    // ignore
  }
}

export function reset() {
  if (!ensureBoot()) return;
  try {
    posthog.reset();
  } catch {
    // ignore
  }
}

export const isAnalyticsEnabled = () => Boolean(KEY);
