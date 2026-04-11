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

  // Guard against the 1-render-cycle gap where loadingUser just became false
  // but loadingMembership hasn't gone true yet (TanStack Query re-evaluates `enabled` one cycle later).
  // membershipData === undefined means the query has never resolved (still pending or not started).
  const isLoading = loadingUser || (!!currentUser && membershipData === undefined);

  const membership = membershipData?.membership || null;
  const family = membershipData?.family || null;
  const familyId = family?.id || null;
  const isAdmin = membership?.role === 'admin';

  // ── Billing / License state (family is the source of truth) ──────────────
  // Grandfather clause: existing families without billing_status default to 'active'
  const billingStatus = family?.billing_status || (family ? 'active' : null);
  const isReadOnly = billingStatus === 'view_only' || billingStatus === 'suspended';
  const licensePlan = family?.license_plan || 'home';
  const licensedMemberLimit = family?.licensed_member_limit || 4;
  const trialDaysLeft = (() => {
    if (!family?.trial_end_at || billingStatus !== 'trial') return null;
    const diff = new Date(family.trial_end_at) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();



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
    <FamilyContext.Provider value={{ currentUser, family, familyId, familyConfigId, membership, isAdmin, isLoading, refetchMembership, familyConfig, currency, currencySymbol, billingStatus, isReadOnly, licensePlan, licensedMemberLimit, trialDaysLeft }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  return useContext(FamilyContext);
}