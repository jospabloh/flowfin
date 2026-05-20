/**
 * Feature gating configuration for FlowFin's plan tiers.
 *
 * Map of feature_key → plans that include it. Combined with the family's
 * `billing_status` and `license_plan` by `useFeatureGate`.
 *
 * Plan hierarchy (cumulative — each plan inherits the previous one):
 *   home → family_plus → circle
 *
 * `trial` is treated as a preview of all features so the user can validate
 * the product before paying. `view_only` / `suspended` blocks all premium
 * features regardless of `license_plan`.
 *
 * Gating overall stays behind VITE_PAYWALL_GATING_ENABLED until the owner
 * flips it on after manual validation in a sandbox account.
 */

export const PLAN_TIERS = ['home', 'family_plus', 'circle'];

export function planRank(plan) {
  const idx = PLAN_TIERS.indexOf(plan);
  return idx < 0 ? 0 : idx;
}

export const FEATURE_TIERS = {
  // Reports — full export and breakdown — included from Home up.
  'page.Reports': 'home',
  'page.Investments': 'home',
  'page.MSI': 'home',
  'page.Rentals': 'home',
  // Trips with multi-currency split is a Family+ exclusive.
  'page.Trips': 'family_plus',
  // Receipt scanning quotas (monthly count). null = unlimited.
  'receipt_scan_quota': { trial: 5, home: 100, family_plus: null, circle: null },
};

export const RECEIPT_SCAN_FREE_QUOTA = 5;

/**
 * Gating master switch — set VITE_PAYWALL_GATING_ENABLED=true in build env
 * to enforce. Default off so prod rollout is opt-in (mirrors Quick Capture).
 */
export const PAYWALL_GATING_ENABLED =
  import.meta.env.VITE_PAYWALL_GATING_ENABLED === 'true';
