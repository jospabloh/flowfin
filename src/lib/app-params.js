const isNode = typeof document === 'undefined';
const windowObj = isNode ? { sessionStorage: new Map(), localStorage: new Map() } : globalThis;
// Auth tokens live in localStorage so the session is SHARED across tabs — opening
// the app in a new tab reuses the existing session instead of forcing a re-login.
// This matches the rest of the ACACIA portfolio (puntos/stockflow/liuma/rumbo).
// SECURITY TRADE-OFF (reviewed): a token at rest in localStorage is readable by a
// future XSS for longer than a per-tab sessionStorage token. We accept it for the
// cross-tab UX + portfolio consistency; defense stays on preventing XSS (CSP, no
// unsafe innerHTML) and on the short token lifetime Base44 controls.
const storage = windowObj.localStorage;

// FlowFin's public Base44 app id (see base44/.app.jsonc). Baked in as the ultimate
// fallback so `appId` is NEVER null even when the build has no VITE_BASE44_APP_ID
// and the URL carries no `app_id` param: a null appId makes AuthContext request
// `.../public-settings/by-id/null`, which Base44 rejects with ObjectNotFoundError
// ("Invalid id value: null") and the app can't boot or log in. The id is public
// (it already appears in asset URLs), so it is safe to ship.
const DEFAULT_APP_ID = '69b97ea9c9a713486b5a01fd';

// Storage keys an EARLIER build of this app kept in sessionStorage. The storage
// backend for ALL app params moved sessionStorage → localStorage, so migrate every
// persisted key once (not just the tokens) — otherwise returning users lose app_id
// (→ appId null → boot/login breaks) and functions_version / app_base_url. Done
// once so users currently signed in are NOT logged out by the change.
const LEGACY_STORAGE_KEYS = [
	'base44_access_token',
	'token',
	'base44_app_id',
	'base44_functions_version',
	'base44_app_base_url',
	'base44_from_url',
];

const migrateLegacyStorage = () => {
	if (isNode || !windowObj.sessionStorage) return;
	for (const key of LEGACY_STORAGE_KEYS) {
		try {
			const sessionValue = windowObj.sessionStorage.getItem(key);
			if (sessionValue && !storage.getItem(key)) {
				storage.setItem(key, sessionValue);
			}
			windowObj.sessionStorage.removeItem(key);
		} catch {
			// Storage access can throw in locked-down browser modes; ignore.
		}
	}
};

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

// A param can arrive as the literal strings "null" or "undefined" — e.g. a build
// that injected VITE_BASE44_APP_ID=null, a `?app_id=null` URL (the exact symptom
// we hit), or a stale value an earlier broken build persisted to storage. Those
// are NOT valid values: the old `value || DEFAULT_APP_ID` guard treated "null" as
// truthy, so appId became the string "null", the SDK requested
// `.../public-settings/by-id/null`, and Base44 answered ObjectNotFoundError
// ("Invalid id value: null") — login broke. Normalize these (and blank/whitespace)
// to undefined so every caller falls through to the next source (→ DEFAULT_APP_ID).
const cleanParamValue = (value) => {
	if (value == null) return undefined;
	const trimmed = String(value).trim();
	if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
		return undefined;
	}
	return trimmed;
}

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(globalThis.location.search);
	const searchParam = cleanParamValue(urlParams.get(paramName));
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${globalThis.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${globalThis.location.hash}`;
		globalThis.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}
	const cleanDefault = cleanParamValue(defaultValue);
	if (cleanDefault) {
		storage.setItem(storageKey, cleanDefault);
		return cleanDefault;
	}
	// A prior broken build may have persisted the literal "null"; clean it so we
	// don't hand a bogus value back (and let the next load re-derive a good one).
	const storedValue = cleanParamValue(storage.getItem(storageKey));
	if (storedValue) {
		return storedValue;
	}
	return null;
}

const getAppParams = () => {
	migrateLegacyStorage();
	// `clear_access_token` is a ONE-SHOT signal Base44 appends to the URL on logout.
	// Read it straight from the URL and strip it — never cache it. The generic
	// getAppParamValue() persists every param it reads, so reading the flag through
	// it would leave `base44_clear_access_token=true` stuck in storage, wiping the
	// token on every later load (and re-login on new tabs).
	if (!isNode) {
		const urlParams = new URLSearchParams(globalThis.location.search);
		if (urlParams.get('clear_access_token') === 'true') {
			storage.removeItem('base44_access_token');
			storage.removeItem('token');
			urlParams.delete('clear_access_token');
			const newUrl = `${globalThis.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}${globalThis.location.hash}`;
			globalThis.history.replaceState({}, document.title, newUrl);
		}
		storage.removeItem('base44_clear_access_token'); // undo prior sticky caching
	}
	return {
		// cleanParamValue on the env var too: a build can bake VITE_BASE44_APP_ID as
		// the string "null"/"undefined", which `|| DEFAULT_APP_ID` would NOT replace.
		appId: getAppParamValue("app_id", { defaultValue: cleanParamValue(import.meta.env.VITE_BASE44_APP_ID) || DEFAULT_APP_ID }),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: getAppParamValue("from_url", { defaultValue: globalThis.location.href }),
		functionsVersion: getAppParamValue("functions_version", { defaultValue: cleanParamValue(import.meta.env.VITE_BASE44_FUNCTIONS_VERSION) }),
		appBaseUrl: getAppParamValue("app_base_url", { defaultValue: cleanParamValue(import.meta.env.VITE_BASE44_APP_BASE_URL) }),
	}
}


export const appParams = {
	...getAppParams()
}
