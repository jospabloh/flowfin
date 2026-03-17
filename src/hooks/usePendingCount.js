import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';

export function usePendingCount() {
  const { familyId } = useFamily();
  const { data = 0 } = useQuery({
    queryKey: ['pending-count', familyId],
    queryFn: async () => {
      const txns = await base44.entities.Transaction.filter({ family_id: familyId }, '-date', 2000);
      return txns.filter(t => !t.person_id || !t.category_id).length;
    },
    enabled: !!familyId,
    staleTime: 300000,
  });
  return data;
}