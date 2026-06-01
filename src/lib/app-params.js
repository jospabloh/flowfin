const isNode = typeof document === 'undefined';
const windowObj = isNode ? { sessionStorage: new Map(), localStorage: new Map() } : globalThis;
// Auth tokens are kept in sessionStorage (cleared when the tab closes) instead of
// localStorage to avoid a persistent token at rest that any future XSS could read
// long after the user has left. sessionStorage still survives same-tab refresh, so
// there is no re-authentication regression.
const storage = windowObj.sessionStorage;

// Token keys that older builds wrote to localStorage. We migrate them to sessionStorage
// once (so already-signed-in users aren't logged out on deploy) and then keep
// localStorage free of tokens.
const LEGACY_TOKEN_KEYS = ['base44_access_token', 'token'];

const migrateLegacyTokenStorage = () => {
	if (isNode || !windowObj.localStorage) return;
	for (const key of LEGACY_TOKEN_KEYS) {
		try {
			const legacyValue = windowObj.localStorage.getItem(key);
			if (legacyValue && !storage.getItem(key)) {
				storage.setItem(key, legacyValue);
			}
			windowObj.localStorage.removeItem(key);
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
	if (getAppParamValue("clear_access_token") === 'true') {
		storage.removeItem('base44_access_token');
		storage.removeItem('token');
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
