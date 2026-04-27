import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';

/**
 * Hook to count incomplete transactions (missing person_id or category_id)
 * 
 * OPTIMIZATION: Instead of fetching all 2000 transactions and filtering,
 * we now fetch a minimal set (200 recent) and aggregate. This is more
 * efficient as most transactions are completed within a short time window.
 * 
 * For very large datasets, consider adding a dedicated backend endpoint
 * that returns just the count of pending transactions.
 */
export function usePendingCount() {
  const { familyId } = useFamily();
  const { data = 0 } = useQuery({
    queryKey: ['pending-count', familyId],
    queryFn: async () => {
      if (!familyId) return 0;
      // Fetch only recent transactions (limited to 200) for better performance
      const recentTxns = await base44.entities.Transaction.filter(
        { family_id: familyId },
        '-date',
        200 // Reduced from 2000
      );
      // Count incomplete transactions (missing required fields)
      return recentTxns.filter(t => !t.person_id || !t.category_id).length;
    },
    enabled: !!familyId,
    staleTime: 300000, // 5 minutes
  });
  return data;
}
