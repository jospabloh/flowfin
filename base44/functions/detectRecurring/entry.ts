import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function assertFamilyMember(base44, familyId) {
  const user = await base44.auth.me();
  if (!user) { const err = new Error('Unauthorized'); err.httpStatus = 401; throw err; }
  if (user.role === 'admin') return { user, membership: null };
  let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_id: user.id, family_id: familyId, status: 'approved' });
  if (!memberships.length) memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_email: user.email, family_id: familyId, status: 'approved' });
  if (!memberships.length) { const err = new Error('forbidden'); err.httpStatus = 403; throw err; }
  return { user, membership: memberships[0] };
}

function normalizeKey(text: string): string {
  return text.toLowerCase().trim().slice(0, 40);
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ candidates: [] }, { status: 401 });

    const { familyId } = await req.json();
    if (!familyId) return Response.json({ candidates: [] });

    // Authorization: the caller passes familyId in the body, so verify they
    // actually belong to that family before reading its transactions.
    try {
      await assertFamilyMember(base44, familyId);
    } catch (err) {
      return Response.json({ error: 'forbidden' }, { status: err.httpStatus || 403 });
    }

    // Fetch last 6 months of expense transactions + active ScheduledPayments
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffISO = cutoff.toISOString().slice(0, 10);

    const [transactions, scheduledPayments] = await Promise.all([
      base44.entities.Transaction.filter({ family_id: familyId, type: 'expense' }, '-date', 2000),
      base44.entities.ScheduledPayment.filter({ family_id: familyId, is_active: true }),
    ]);

    const recent = transactions.filter(t => t.date >= cutoffISO && t.description);

    // Group by normalized description
    const groups: Record<string, { description: string; categoryId: string; months: Set<string>; amounts: number[] }> = {};

    for (const t of recent) {
      if (!t.description || !t.amount) continue;
      const key = normalizeKey(t.description);
      const month = t.date.slice(0, 7); // YYYY-MM
      if (!groups[key]) {
        groups[key] = {
          description: t.description,
          categoryId: t.category_id || '',
          months: new Set(),
          amounts: [],
        };
      }
      groups[key].months.add(month);
      groups[key].amounts.push(t.amount);
    }

    // Normalize existing scheduled payment names for dedup check
    const existingNames = new Set(
      scheduledPayments.map(p => normalizeKey(p.name || ''))
    );

    const candidates: Array<{
      description: string;
      categoryId: string;
      estimatedAmount: number;
      months: string[];
      confidence: 'high' | 'medium';
    }> = [];

    for (const [key, group] of Object.entries(groups)) {
      const monthCount = group.months.size;
      if (monthCount < 3) continue;

      // Check amount variance: max/min ratio should be within 1.4x (≈ 20% of median)
      const med = median(group.amounts);
      const maxAmt = Math.max(...group.amounts);
      const minAmt = Math.min(...group.amounts);
      if (med > 0 && maxAmt / minAmt > 1.4) continue;

      // Skip if already covered by a ScheduledPayment name
      const alreadyCovered = [...existingNames].some(name =>
        name.includes(key.slice(0, 15)) || key.includes(name.slice(0, 15))
      );
      if (alreadyCovered) continue;

      candidates.push({
        description: group.description,
        categoryId: group.categoryId,
        estimatedAmount: Math.round(med * 100) / 100,
        months: [...group.months].sort(),
        confidence: monthCount >= 5 ? 'high' : 'medium',
      });
    }

    // Sort by confidence then month count
    candidates.sort((a, b) => {
      if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1;
      return b.months.length - a.months.length;
    });

    return Response.json({ candidates: candidates.slice(0, 10) });
  } catch {
    return Response.json({ candidates: [] });
  }
});
