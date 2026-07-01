import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function assertFamilyMember(base44, familyId) {
  const user = await base44.auth.me();
  if (!user) { const err = new Error('Unauthorized'); err.httpStatus = 401; throw err; }
  if (user.role === 'admin') return { user, membership: null };
  let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_id: user.id, family_id: familyId, status: 'approved' });
  if (!memberships.length) memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_email: user.email, family_id: familyId, status: 'approved' });
  if (!memberships.length) { const err = new Error('forbidden'); err.httpStatus = 403; throw err; }
  return { user, membership: memberships[0] };
}

export async function handle(req: Request, body: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const { familyId } = body;
    if (!familyId) return Response.json({ chips: [] });

    // Reject access to a family the caller isn't a member of (returns empty,
    // keeping the chips UI graceful instead of erroring).
    try {
      await assertFamilyMember(base44, familyId);
    } catch {
      return Response.json({ chips: [] });
    }

    // Use service role (RLS enforced by entities)
    const entities = base44.asServiceRole.entities;
    
    // Fetch last 200 transactions sorted by -date
    const transactions = await entities.Transaction.filter({ family_id: familyId }, '-date', 200);

    // Fetch categories for label fallback
    const categories = await entities.Category.filter({ family_id: familyId });

    // Determine current dayOfWeek and timeSlot from server time
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 (Sun) – 6 (Sat)
    const currentHour = now.getHours();
    const currentTimeSlot = Math.floor(currentHour / 3); // 0-7

    // Group transactions by (dayOfWeek, timeSlot)
    // Key: "dow_slot"
    interface GroupEntry {
      tx: typeof transactions[number];
      recencyIndex: number; // lower index = more recent
    }
    const groups: Record<string, GroupEntry[]> = {};

    transactions.forEach((tx, index) => {
      if (!tx.date) return;
      const txDate = new Date(tx.date);
      const dow = txDate.getDay();
      // Approximate hour from transaction if stored, default to noon
      const hour = txDate.getHours?.() ?? 12;
      const slot = Math.floor(hour / 3);
      const key = `${dow}_${slot}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ tx, recencyIndex: index });
    });

    // Focus on the current (dayOfWeek, timeSlot) group
    const currentKey = `${currentDayOfWeek}_${currentTimeSlot}`;
    const groupEntries = groups[currentKey] ?? [];

    // If the current group is empty, fall back to same dayOfWeek any slot
    const candidateEntries: GroupEntry[] = groupEntries.length > 0
      ? groupEntries
      : transactions
          .map((tx, index) => ({ tx, recencyIndex: index }))
          .filter(({ tx }) => {
            if (!tx.date) return false;
            return new Date(tx.date).getDay() === currentDayOfWeek;
          });

    if (candidateEntries.length === 0) {
      return Response.json({ chips: [] });
    }

    // Score each entry by recency: newer entries (lower index) = higher weight
    // Weight = 1 / (recencyIndex + 1)
    interface ScoredCandidate {
      tx: typeof transactions[number];
      weight: number;
    }
    const scored: ScoredCandidate[] = candidateEntries.map(({ tx, recencyIndex }) => ({
      tx,
      weight: 1 / (recencyIndex + 1),
    }));

    // Group scored candidates by a composite key to find top patterns
    // Key: category_id + description (normalised)
    interface PatternData {
      totalWeight: number;
      count: number;
      descFreq: Record<string, number>;
      amounts: number[];
      categoryId: string;
      subcategoryId?: string;
      personId?: string;
      paymentMethodId?: string;
    }
    const patterns: Record<string, PatternData> = {};

    scored.forEach(({ tx, weight }) => {
      const catId = tx.category_id || '__none__';
      const descNorm = (tx.description ?? '').toLowerCase().trim();
      const patternKey = `${catId}||${descNorm}`;

      if (!patterns[patternKey]) {
        patterns[patternKey] = {
          totalWeight: 0,
          count: 0,
          descFreq: {},
          amounts: [],
          categoryId: catId,
          subcategoryId: tx.subcategory_id,
          personId: tx.person_id,
          paymentMethodId: tx.payment_method_id,
        };
      }

      const p = patterns[patternKey];
      p.totalWeight += weight;
      p.count++;
      p.amounts.push(tx.amount || 0);

      if (descNorm) {
        p.descFreq[descNorm] = (p.descFreq[descNorm] || 0) + 1;
      }

      // Update person/payment method to the most recently seen ones
      // (they come in recency order, so first occurrence per pattern is most recent)
      if (!p.personId && tx.person_id) p.personId = tx.person_id;
      if (!p.paymentMethodId && tx.payment_method_id) p.paymentMethodId = tx.payment_method_id;
    });

    // Sort patterns by total weight descending, pick top 3
    const topPatterns = Object.values(patterns)
      .sort((a, b) => b.totalWeight - a.totalWeight)
      .slice(0, 3);

    const chips = topPatterns.map(p => {
      // Label: most common description in the group, or category name as fallback
      const topDesc = Object.keys(p.descFreq).sort((a, b) => p.descFreq[b] - p.descFreq[a])[0];
      const category = categories.find(c => c.id === p.categoryId);
      const label = topDesc
        ? topDesc.charAt(0).toUpperCase() + topDesc.slice(1)
        : (category?.name ?? 'Gasto');

      // Average amount
      const amount = p.amounts.length > 0
        ? Math.round(p.amounts.reduce((s, a) => s + a, 0) / p.amounts.length)
        : 0;

      const chip: {
        label: string;
        amount: number;
        categoryId: string;
        subcategoryId?: string;
        personId?: string;
        paymentMethodId?: string;
      } = {
        label,
        amount,
        categoryId: p.categoryId === '__none__' ? '' : p.categoryId,
      };

      if (p.subcategoryId) chip.subcategoryId = p.subcategoryId;
      if (p.personId) chip.personId = p.personId;
      if (p.paymentMethodId) chip.paymentMethodId = p.paymentMethodId;

      return chip;
    });

    return Response.json({ chips });
  } catch {
    return Response.json({ chips: [] });
  }
}
