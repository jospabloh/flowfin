import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Detects possible duplicate transactions before saving.
// Checks recent transactions in the authenticated user's family only.
// Never exposes internal IDs.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const entities = base44.asServiceRole.entities;

    let memberships = await entities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) memberships = await entities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    if (!memberships.length) return Response.json({ error: 'forbidden' }, { status: 403 });

    const activeId = user.data?.family_id ?? user.data?.data?.family_id;
    const membership = memberships.find(m => m.family_id === activeId)
      ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
    const familyId = membership.family_id;

    const body = await req.json().catch(() => ({}));
    const { amount, date, description, category_id, payment_method_id } = body;

    if (!amount || !date) {
      return Response.json({ error: 'amount and date are required' }, { status: 400 });
    }

    // Search window: ±3 days
    const targetDate = new Date(date + 'T12:00:00Z');
    const windowStart = new Date(targetDate.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const windowEnd = new Date(targetDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Fetch recent transactions in window
    const recentTxs = await entities.Transaction.filter(
      { family_id: familyId },
      '-date',
      100
    );

    const inWindow = (recentTxs || []).filter(tx => tx.date >= windowStart && tx.date <= windowEnd);

    const matches = [];
    for (const tx of inWindow) {
      if (typeof tx.amount !== 'number') continue;

      // Amount match (within 1%)
      const amountDiff = Math.abs(tx.amount - amount) / Math.max(amount, 1);
      if (amountDiff > 0.01) continue;

      let score = 0;
      if (tx.date === date) score += 3;
      else score += 1;

      if (category_id && tx.category_id === category_id) score += 2;
      if (payment_method_id && tx.payment_method_id === payment_method_id) score += 2;

      if (description && tx.description) {
        const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalize(tx.description).includes(normalize(description)) ||
            normalize(description).includes(normalize(tx.description))) {
          score += 3;
        }
      }

      if (score >= 3) {
        matches.push({
          date: tx.date,
          amount: tx.amount,
          description: tx.description ? String(tx.description).slice(0, 60) : null,
          score,
        });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, 3);

    const hasPossibleDuplicate = topMatches.length > 0;
    const confidence = hasPossibleDuplicate
      ? Math.min(topMatches[0].score / 10, 1.0)
      : 0;

    return Response.json({
      has_possible_duplicate: hasPossibleDuplicate,
      confidence,
      matches: topMatches,
      warning: hasPossibleDuplicate
        ? `Encontré ${topMatches.length} movimiento(s) similar(es) registrado(s) recientemente. Revísalo antes de guardar para evitar duplicados.`
        : null,
    });
  } catch (error) {
    console.error('finiaDetectDuplicates error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});