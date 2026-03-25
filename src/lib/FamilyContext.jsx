import { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

const FamilyContext = createContext(null);

export function FamilyProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoadingUser(false), 5000);
    base44.auth.me()
      .then(u => { setCurrentUser(u); setLoadingUser(false); })
      .catch(() => setLoadingUser(false))
      .finally(() => clearTimeout(timeout));
  }, []);

  const { data: membershipData, isLoading: loadingMembership, refetch: refetchMembership } = useQuery({
    queryKey: ['my-membership', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return null;
      try {
        // Call getMyMembership which handles syncing internally
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
    retry: false,
  });

  const membership = membershipData?.membership || null;
  const family = membershipData?.family || null;
  const familyId = family?.id || null;
  const isAdmin = membership?.role === 'admin';

  // Debug logging
  useEffect(() => {
    console.log('[FamilyContext]', {
      isLoading,
      currentUser: currentUser?.email,
      membership: membership?.id,
      family: family?.name,
      familyId,
    });
  }, [isLoading, currentUser?.email, membership?.id, family?.name, familyId]);

  // familyConfig comes directly from getMyMembership (service role) — works for ALL members
  const familyConfig = membershipData?.familyConfig || null;
  const currency = familyConfig?.currency || family?.currency || 'MXN';
  const currencySymbol = familyConfig?.currency_symbol || family?.currency_symbol || '$';

  const isLoading = loadingUser || loadingMembership;

  return (
    <FamilyContext.Provider value={{ currentUser, family, familyId, membership, isAdmin, isLoading, refetchMembership, familyConfig, currency, currencySymbol }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  return useContext(FamilyContext);
}