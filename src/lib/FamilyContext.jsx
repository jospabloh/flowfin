import { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

const FamilyContext = createContext(null);

export function FamilyProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setCurrentUser(u); setLoadingUser(false); }).catch(() => setLoadingUser(false));
  }, []);

  const { data: membershipData, isLoading: loadingMembership, refetch: refetchMembership } = useQuery({
    queryKey: ['my-membership', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return null;
      try {
        const res = await base44.functions.invoke('getMyMembership', {});
        return res.data || null;
      } catch {
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
  const loadingFamily = false;

  const isLoading = loadingUser || loadingMembership;
  const familyId = family?.id || null;
  const isAdmin = membership?.role === 'admin';

  return (
    <FamilyContext.Provider value={{ currentUser, family, familyId, membership, isAdmin, isLoading, refetchMembership }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  return useContext(FamilyContext);
}