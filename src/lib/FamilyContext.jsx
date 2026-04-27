import { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

async function syncUserPrefsToLS(user) {
  try {
    if (user?.preferences) {
      localStorage.setItem('ff_user_prefs', JSON.stringify(user.preferences));
    }
  } catch {
    // Ignore localStorage write failures; preferences still come from API data.
  }
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

  // ── Step 1: Load membership directly from entity SDK (no backend function) ──
  const { data: membership, isLoading: loadingMembership, isError: membershipError, refetch: refetchMembership } = useQuery({
    queryKey: ['my-membership', currentUser?.id],
    queryFn: async () => {
      // Try by user_id first
      let results = await base44.entities.FamilyMembership.filter({ user_id: currentUser.id, status: 'approved' });
      if (!results.length) {
        // Fallback to email
        results = await base44.entities.FamilyMembership.filter({ user_email: currentUser.email, status: 'approved' });
      }
      return results[0] || null;
    },
    enabled: !!currentUser,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 6000),
  });

  // ── Step 2: Load family once we have membership ──
  const familyId = membership?.family_id || null;

  const { data: family, isLoading: loadingFamily } = useQuery({
    queryKey: ['family', familyId],
    queryFn: async () => {
      const results = await base44.entities.Family.filter({ id: familyId });
      return results[0] || null;
    },
    enabled: !!familyId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  // ── Step 3: Load familyConfig ──
  const { data: familyConfig } = useQuery({
    queryKey: ['family-config', familyId],
    queryFn: async () => {
      const results = await base44.entities.FamilyConfig.filter({ family_id: familyId });
      return results[0] || null;
    },
    enabled: !!familyId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  // ── Step 4: Load license info (low priority) ──
  const { data: licenseInfo } = useQuery({
    queryKey: ['family-license', familyId],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('getFamilyLicenseInfo', {});
        return res.data || null;
      } catch {
        // Ignore transient license-info errors; UI falls back to family entity values.
        return null;
      }
    },
    enabled: !!familyId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ── Step 5: Fire-and-forget analytics ──
  useQuery({
    queryKey: ['detectAnomalies', familyId],
    queryFn: () => base44.functions.invoke('detectAnomalies', { familyId }).then(r => r.data),
    enabled: !!familyId,
    staleTime: 6 * 60 * 60 * 1000,   // 6 hours — don't refetch within same session
    gcTime: 6 * 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  useQuery({
    queryKey: ['buildUserProfile', familyId],
    queryFn: () => base44.functions.invoke('buildUserProfile', { familyId }).then(r => r.data),
    enabled: !!familyId,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  // Sync family rules to localStorage
  useEffect(() => {
    if (familyConfig?.smart_rules) {
      try { localStorage.setItem('ff_family_rules', JSON.stringify(familyConfig.smart_rules)); } catch {
        // Ignore localStorage write failures; source of truth remains server-side config.
      }
    }
  }, [familyConfig?.id]);

  // isLoading: true while user loads OR while membership query is pending/running
  const isLoading = loadingUser || (!!currentUser && membership === undefined) || (!!familyId && family === undefined);

  const isAdmin = membership?.role === 'admin';

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

  const familyConfigId = familyConfig?.id || null;
  const currency = familyConfig?.currency || family?.currency || 'MXN';
  const currencySymbol = familyConfig?.currency_symbol || family?.currency_symbol || '$';

  // refetchMembership now also invalidates family
  const refetchAll = async () => {
    await refetchMembership();
  };

  return (
    <FamilyContext.Provider value={{
      currentUser,
      family,
      familyId,
      familyConfigId,
      membership,
      isAdmin,
      isLoading,
      membershipError,
      refetchMembership: refetchAll,
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
