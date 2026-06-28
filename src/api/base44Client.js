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

// The access token is INTENTIONALLY persisted in localStorage (key
// `base44_access_token`, the SDK's default) so the session survives reloads and
// is shared across tabs — see the trade-off note in src/lib/app-params.js. Both
// the SDK (during construction) and app-params write that key.
//
// Do NOT scrub it here. An earlier build kept tokens in sessionStorage and wiped
// the localStorage copies right after createClient(); after the migration to
// localStorage that leftover scrub deleted the only persisted token, so every
// reload/navigation lost the session and the user appeared to be "logged out"
// seconds after a successful login.
