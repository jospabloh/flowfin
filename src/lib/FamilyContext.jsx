import { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

// Sincroniza preferencias de usuario al localStorage en background
async function syncUserPrefsToLS(user) {
  try {
    if (user?.preferences) {
      localStorage.setItem('ff_user_prefs', JSON.stringify(user.preferences));
    }
  } catch {}
}

const FamilyContext = createContext(null);

export function FamilyProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoadingUser(false), 5000);
    base44.auth.me()
      .then(u => { setCurrentUser(u); setLoadingUser(false); syncUserPrefsToLS(u); })
      .catch(() => setLoadingUser(false))
      .finally(() => clearTimeout(timeout));
  }, []);

  const { data: membershipData, isLoading: loadingMembership, refetch: refetchMembership } = useQuery({
    queryKey: ['my-membership', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return null;
      try {
        // Call getMyMembership which auto-syncs family_id if needed
        const res = await base44.functions.invoke('getMyMembership', {});
        return res.data || null;
      } catch (err) {
        console.error('FamilyContext: getMyMembership failed:', err);
        return null;
      }
    },
    enabled: !!currentUser,
    staleTime: 0,
    gcTime: 0,
    retry: 2,
  });

  // Load extended license info
  const { data: licenseInfo } = useQuery({
    queryKey: ['family-license', currentUser?.id, membershipData?.family?.id],
    queryFn: async () => {
      if (!membershipData?.family?.id) return null;
      try {
        const res = await base44.functions.invoke('getFamilyLicenseInfo', {});
        return res.data || null;
      } catch (err) {
        console.error('FamilyContext: getFamilyLicenseInfo failed:', err);
        return null;
      }
    },
    enabled: !!membershipData?.family?.id,
    staleTime: 60 * 1000, // 1 min cache for license state
    gcTime: 5 * 60 * 1000,
  });

  // Guard against the 1-render-cycle gap where loadingUser just became false
  // but loadingMembership hasn't gone true yet (TanStack Query re-evaluates `enabled` one cycle later).
  // membershipData === undefined means the query has never resolved (still pending or not started).
  const isLoading = loadingUser || (!!currentUser && membershipData === undefined);

  const membership = membershipData?.membership || null;
  const family = membershipData?.family || null;
  const familyId = family?.id || null;
  const isAdmin = membership?.role === 'admin';

  // ── Billing / License state (resolved server-side for safety) ──────────────
  // Use licenseInfo from getFamilyLicenseInfo if available (server-resolved)
  // Otherwise fall back to local calculation for compatibility
  const billingStatus = licenseInfo?.billingStatus || family?.billing_status || (family ? 'active' : null);
  const isReadOnly = licenseInfo?.isReadOnly ?? (billingStatus === 'view_only' || billingStatus === 'suspended');
  const licensePlan = licenseInfo?.licensePlan || family?.license_plan || 'home';
  const licensedMemberLimit = licenseInfo?.licensedMemberLimit || family?.licensed_member_limit || 4;
  const trialDaysLeft = licenseInfo?.trialDaysLeft ?? null;
  const activeMemberCount = licenseInfo?.activeMemberCount ?? null;
  const trialStartAt = licenseInfo?.trialStartAt || family?.trial_start_at || null;
  const trialEndAt = licenseInfo?.trialEndAt || family?.trial_end_at || null;
  const licenseActivatedAt = licenseInfo?.licenseActivatedAt || family?.license_activated_at || null;
  const licenseExpiresAt = licenseInfo?.licenseExpiresAt || family?.license_expires_at || null;

  // familyConfig comes directly from getMyMembership (service role) — works for ALL members
  const familyConfig = membershipData?.familyConfig || null;
  const familyConfigId = familyConfig?.id || null;

  // Sincronizar smart_rules al localStorage cuando llegan los datos de familia
  useEffect(() => {
    if (familyConfig?.smart_rules) {
      try { localStorage.setItem('ff_family_rules', JSON.stringify(familyConfig.smart_rules)); } catch {}
    }
  }, [familyConfig?.id]);
  const currency = familyConfig?.currency || family?.currency || 'MXN';
  const currencySymbol = familyConfig?.currency_symbol || family?.currency_symbol || '$';

  return (
    <FamilyContext.Provider value={{
      currentUser,
      family,
      familyId,
      familyConfigId,
      membership,
      isAdmin,
      isLoading,
      refetchMembership,
      familyConfig,
      currency,
      currencySymbol,
      billingStatus,
      isReadOnly,
      licensePlan,
      licensedMemberLimit,
      trialDaysLeft,
      activeMemberCount,
      trialStartAt,
      trialEndAt,
      licenseActivatedAt,
      licenseExpiresAt,
    }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  return useContext(FamilyContext);
}