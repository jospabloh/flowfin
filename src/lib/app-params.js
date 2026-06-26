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

// Token keys an EARLIER build of this app kept in sessionStorage. Migrate them to
// localStorage once so users currently signed in (token only in sessionStorage)
// are NOT logged out by this change.
const LEGACY_TOKEN_KEYS = ['base44_access_token', 'token'];

const migrateLegacyTokenStorage = () => {
	if (isNode || !windowObj.sessionStorage) return;
	for (const key of LEGACY_TOKEN_KEYS) {
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

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(globalThis.location.search);
	const searchParam = urlParams.get(paramName);
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
	if (defaultValue) {
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	if (storedValue) {
		return storedValue;
	}
	return null;
}

const getAppParams = () => {
	migrateLegacyTokenStorage();
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
		appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: getAppParamValue("from_url", { defaultValue: globalThis.location.href }),
		functionsVersion: getAppParamValue("functions_version", { defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION }),
		appBaseUrl: getAppParamValue("app_base_url", { defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL }),
	}
}


export const appParams = {
	...getAppParams()
}
