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

  const { data: membership, isLoading: loadingMembership, refetch: refetchMembership } = useQuery({
    queryKey: ['my-membership', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return null;
      const results = await base44.entities.FamilyMembership.filter({ user_id: currentUser.id, status: 'approved' });
      return results[0] || null;
    },
    enabled: !!currentUser,
  });

  const { data: family, isLoading: loadingFamily } = useQuery({
    queryKey: ['family', membership?.family_id],
    queryFn: () => base44.entities.Family.filter({ id: membership.family_id }).then(r => r[0] || null),
    enabled: !!membership?.family_id,
  });

  const isLoading = loadingUser || loadingMembership || (!!membership && loadingFamily);
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