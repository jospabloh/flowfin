import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// The Base44 SDK persists the access token to localStorage during construction.
// We pass the token explicitly above (so the SDK never needs to read it back),
// which lets us keep tokens out of persistent localStorage and only in
// sessionStorage (see src/lib/app-params.js). Scrub the localStorage copies the
// SDK just wrote.
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    window.localStorage.removeItem('base44_access_token');
    window.localStorage.removeItem('token');
  } catch {
    // Storage access can throw in locked-down browser modes; ignore.
  }
}
