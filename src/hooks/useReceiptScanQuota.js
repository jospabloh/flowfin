import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { FEATURE_TIERS, PAYWALL_GATING_ENABLED } from '@/lib/featureGates';

/**
 * Returns this month's receipt-scan usage and limit for the active family
 * based on the configured plan tier. The limit is null when unlimited.
 *
 * Gating is preemptive UX only — the server (scanReceipt/entry.ts) keeps
 * its own daily cap which is the source of truth.
 */
export function useReceiptScanQuota() {
  const { familyId, billingStatus, licensePlan, currentUser } = useFamily();

  const month = new Date().toISOString().slice(0, 7); // YYYY-MM

  const { data: used = 0, isLoading } = useQuery({
    queryKey: ['receipt-scan-usage', familyId, month],
    queryFn: async () => {
      if (!familyId) return 0;
      try {
        const rows = await base44.entities.AssistantUsage.filter({
          family_id: familyId,
          operation: 'receipt_scan',
        });
        if (!rows?.length) return 0;
        const prefix = `${month}-`;
        return rows.filter((row) => (row.created_at || '').startsWith(prefix)).length;
      } catch {
        return 0;
      }
    },
    enabled: !!familyId,
    staleTime: 60 * 1000,
  });

  const quotas = FEATURE_TIERS.receipt_scan_quota;
  const effectivePlanKey = billingStatus === 'trial' ? 'trial' : (licensePlan || 'home');
  const limit = quotas?.[effectivePlanKey] ?? null;

  const isPlatformAdmin = currentUser?.role === 'admin';
  const gatingActive = PAYWALL_GATING_ENABLED && !isPlatformAdmin;
  const exceeded = gatingActive && limit !== null && used >= limit;
  const remaining = limit === null ? null : Math.max(0, limit - used);

  return {
    used,
    limit,
    remaining,
    exceeded,
    isLoading,
    gatingActive,
    effectivePlanKey,
  };
}
