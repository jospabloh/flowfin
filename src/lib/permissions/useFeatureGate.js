import { useFamily } from '@/lib/FamilyContext';
import { FEATURE_TIERS, PAYWALL_GATING_ENABLED, planRank } from '@/lib/featureGates';

/**
 * useFeatureGate — plan-based feature gating.
 *
 * Returns `{ status, requiredPlan, currentPlan, billingStatus, isLoading }`:
 *   - 'loading' while FamilyContext is still resolving (UI should render a
 *     skeleton, NOT a paywall — avoids the flash for paying users).
 *   - 'allowed' when the user can use the feature.
 *   - 'denied' when the feature is gated for the current plan.
 *
 * Resolution order (highest priority first):
 *   1. Platform admin (currentUser.role === 'admin') → always allowed.
 *   2. Master switch off (VITE_PAYWALL_GATING_ENABLED !== 'true') → allowed
 *      so existing trial users see no change until owner enables gating.
 *   3. billing_status in ['view_only','suspended'] → denied (existing rule).
 *   4. billing_status === 'trial' → allowed (preview window).
 *   5. licensePlan rank >= required rank → allowed; else denied.
 */
export function useFeatureGate(featureKey) {
  const { currentUser, isLoading, billingStatus, licensePlan } = useFamily();

  if (isLoading) {
    return {
      status: 'loading',
      requiredPlan: null,
      currentPlan: licensePlan || null,
      billingStatus: billingStatus || null,
      isLoading: true,
    };
  }

  if (currentUser?.role === 'admin') {
    return { status: 'allowed', requiredPlan: null, currentPlan: licensePlan, billingStatus, isLoading: false };
  }

  if (!PAYWALL_GATING_ENABLED) {
    return { status: 'allowed', requiredPlan: null, currentPlan: licensePlan, billingStatus, isLoading: false };
  }

  const required = FEATURE_TIERS[featureKey];
  if (!required || typeof required === 'object') {
    return { status: 'allowed', requiredPlan: null, currentPlan: licensePlan, billingStatus, isLoading: false };
  }

  if (billingStatus === 'view_only' || billingStatus === 'suspended') {
    return { status: 'denied', requiredPlan: required, currentPlan: licensePlan, billingStatus, isLoading: false };
  }

  if (billingStatus === 'trial') {
    return { status: 'allowed', requiredPlan: required, currentPlan: licensePlan, billingStatus, isLoading: false };
  }

  if (planRank(licensePlan) >= planRank(required)) {
    return { status: 'allowed', requiredPlan: required, currentPlan: licensePlan, billingStatus, isLoading: false };
  }

  return { status: 'denied', requiredPlan: required, currentPlan: licensePlan, billingStatus, isLoading: false };
}
