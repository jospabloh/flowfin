import { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { identify as analyticsIdentify } from '@/lib/analytics';

function syncUserPrefsToLS(user) {
  try {
    if (user?.preferences) {
      localStorage.setItem('ff_user_prefs', JSON.stringify(user.preferences));
    }
  } catch {
    // Ignore localStorage write failures; preferences still come from API data.
  }
}

const FamilyContext = createContext({
  currentUser: null,
  family: null,
  familyId: null,
  familyConfigId: null,
  membership: null,
  isAdmin: false,
  isLoading: true,
  membershipError: false,
  refetchMembership: () => {},
  familyConfig: null,
  currency: 'MXN',
  currencySymbol: '$',
  billingStatus: null,
  isReadOnly: false,
  licensePlan: 'home',
  licensedMemberLimit: 4,
  trialDaysLeft: null,
  activeMemberCount: null,
  trialStartAt: null,
  trialEndAt: null,
  licenseActivatedAt: null,
  licenseExpiresAt: null,
  defaultPersonId: null,
});

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
  // One user, one family: the family switcher was retired 2026-09-10, so this
  // resolves to a single membership. It still prefers whichever approved row
  // matches the PERSISTED `data.family_id` — that half is not the switcher,
  // it is what keeps reads agreeing with writes (`guardedEntityWrite`'s
  // `resolveFamilyAccess` reads the same persisted pointer). Taking
  // `approved[0]` blindly is how a user with a stale extra membership row
  // ends up reading one family while writing to another, silently.
  const { data: membershipResolution, isError: membershipError, refetch: refetchMembership } = useQuery({
    queryKey: ['my-membership', currentUser?.id],
    queryFn: async () => {
      // Try by user_id first
      let approved = await base44.entities.FamilyMembership.filter({ user_id: currentUser.id, status: 'approved' });
      if (!approved.length) {
        // Fallback to email
        approved = await base44.entities.FamilyMembership.filter({ user_email: currentUser.email, status: 'approved' });
      }
      if (!approved.length) {
        // Fallback: if RLS blocked the direct read (same root cause as the
        // Family read fallback below), use the backend function which reads
        // via asServiceRole. Returns only the single approved membership.
        try {
          const res = await base44.functions.invoke('family', { action: 'getMyMembership' });
          if (res.data?.membership) approved = [res.data.membership];
        } catch { /* keep approved empty — genuine no-membership case */ }
      }

      if (approved.length <= 1) return approved[0] || null;

      // 2+ approved rows (a leftover from when a user could join several
      // families): prefer whichever matches the persisted active family_id so
      // reads and writes agree, and fall back to the first otherwise.
      const activeFamilyId = currentUser?.data?.family_id || currentUser?.data?.data?.family_id || null;
      return approved.find(m => m.family_id === activeFamilyId) || approved[0];
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,  // 5 min — don't re-fetch on every navigation
    gcTime: 10 * 60 * 1000,
    retry: (failCount, error) => {
      // Don't retry on 429 — wait for rate limit to clear
      if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) return false;
      return failCount < 2;
    },
    retryDelay: (attempt) => Math.min(2000 * 3 ** attempt, 15000),
  });

  // Consumers rely on `membership === undefined` while the query is pending.
  const membership = membershipResolution;

  // ── Step 2: Load family once we have membership ──
  const familyId = membership?.family_id || null;

  const { data: family } = useQuery({
    queryKey: ['family', familyId],
    queryFn: async () => {
      const results = await base44.entities.Family.filter({ id: familyId });
      if (results[0]) return results[0];
      // Fallback for non-admin users whose {{user.data.family_id}} doesn't
      // resolve in the Family RLS read rule (the field-level rls.write added
      // 2026-08-23 stripped family_id from non-admin reads and broke the
      // `id === {{user.data.family_id}}` condition). getMyFamily reads via
      // asServiceRole after authorizing through FamilyMembership, so it
      // returns the family reliably regardless of RLS resolution.
      try {
        const res = await base44.functions.invoke('family', { action: 'getMyFamily', family_id: familyId });
        return res.data?.family || null;
      } catch {
        return null;
      }
    },
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: (failCount, error) => {
      if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) return false;
      return failCount < 2;
    },
  });

  // ── Step 3: Load familyConfig ──
  const { data: familyConfig } = useQuery({
    queryKey: ['family-config', familyId],
    queryFn: async () => {
      const results = await base44.entities.FamilyConfig.filter({ family_id: familyId });
      return results[0] || null;
    },
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: (failCount, error) => {
      if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) return false;
      return failCount < 2;
    },
  });

  // ── Step 4: Load license info (low priority) ──
  const { data: licenseInfo } = useQuery({
    queryKey: ['family-license', familyId],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('family', { action: 'getFamilyLicenseInfo',});
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

  // Sync family rules to localStorage
  useEffect(() => {
    if (familyConfig?.smart_rules) {
      try { localStorage.setItem('ff_family_rules', JSON.stringify(familyConfig.smart_rules)); } catch {
        // Ignore localStorage write failures; source of truth remains server-side config.
      }
    }
  }, [familyConfig?.id]);

  // Identify the user in analytics once we have stable ids. Traits stay
  // coarse: no email / name forwarded to the analytics provider.
  useEffect(() => {
    if (!currentUser?.id) return;
    analyticsIdentify(currentUser.id, {
      family_id: familyId || null,
      role: membership?.role || null,
      billing_status: family?.billing_status || null,
      license_plan: family?.license_plan || null,
    });
  }, [currentUser?.id, familyId, membership?.role, family?.billing_status, family?.license_plan]);

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

  // Best-effort default Person for QuickCapture inference. Order matches the
  // Sprint 1 plan: explicit link on the membership → family-level default →
  // null (consumers fall back to first Person from useCatalog).
  const defaultPersonId = membership?.person_id || family?.default_person_id || null;

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
      defaultPersonId,
    }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  return useContext(FamilyContext);
}