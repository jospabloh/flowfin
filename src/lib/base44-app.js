// PUBLIC, non-secret Base44 application identifier.
//
// This is NOT a credential. The app id already ships in the client bundle, in
// asset URLs and in the page URL (`?app_id=...`); it authorizes nothing on its
// own — the real session is the Base44 token + RLS. It is therefore safe to
// commit and ship.
//
// Why a baked-in constant instead of only an env var: committed `.env*` files
// are gitignored in this repo, so a build that doesn't explicitly inject
// `VITE_BASE44_APP_ID` would otherwise resolve `appId` to null. A null appId
// makes AuthContext request `.../public-settings/by-id/null`, which Base44
// rejects with ObjectNotFoundError ("Invalid id value: null") — the app can't
// boot or log in. This constant is the ultimate fallback that prevents that.
//
// Precedence (see app-params.js): URL `app_id` → VITE_BASE44_APP_ID → this.
export const BASE44_PUBLIC_APP_ID = '69b97ea9c9a713486b5a01fd';
