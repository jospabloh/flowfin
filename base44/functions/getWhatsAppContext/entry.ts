import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// WhatsApp context function for Finia agent.
// Resolves user identity, family data, monthly financials and upcoming payments.
// IMPORTANT: base44.asServiceRole does NOT bypass RLS for family-scoped entities
// in the backend function runtime ({{user.data.family_id}} resolves to empty).
// Use base44.entities (user-context) for all family-scoped reads.
// Only use asServiceRole for FamilyMembership and Family (which have admin/user.id paths).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // FamilyMembership is readable via asServiceRole (has user.id / user.email RLS paths)
    const sr = base44.asServiceRole.entities;
    const ue = base44.entities; // user-context — works for family-scoped entities

    // Resolve approved membership
    let memberships = await sr.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) {
      memberships = await sr.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    }
    if (!memberships.length) {
      return Response.json({ error: 'No tienes acceso a ninguna familia activa.' }, { status: 403 });
    }

    const activeId = user.data?.family_id ?? user.data?.data?.family_id;
    const membership = memberships.find(m => m.family_id === activeId)
      ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
    const familyId = membership.family_id;

    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const monthStart = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const next7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const currentMonth = todayISO.slice(0, 7);

    console.log('[getWhatsAppContext] familyId:', familyId, 'personId:', membership.person_id ?? null);

    // Fetch transactions using paginated user-context reads
    const fetchMonthTxs = async () => {
      const PAGE = 200;
      const MAX = 1000;
      const all = [];
      let skip = 0;
      while (true) {
        const page = await ue.Transaction.filter({ family_id: familyId }, '-date', PAGE, skip);
        if (!page || page.length === 0) break;
        let done = false;
        for (const tx of page) {
          if (!tx.date) continue;
          if (tx.date > todayISO) continue;
          if (tx.date < monthStart) { done = true; break; }
          all.push(tx);
          if (all.length >= MAX) { done = true; break; }
        }
        if (done || page.length < PAGE) break;
        skip += PAGE;
      }
      return all;
    };

    // Fetch all data in parallel using user-context for family-scoped entities
    const [persons, families, monthTxs, scheduledArr] = await Promise.all([
      ue.Person.filter({ family_id: familyId }).catch(() => []),
      sr.Family.filter({ id: familyId }).catch(() => []),
      fetchMonthTxs().catch(() => []),
      ue.ScheduledPayment.filter({ family_id: familyId, is_active: true }).catch(() => []),
    ]);

    console.log('[getWhatsAppContext] persons:', persons.length, 'monthTxs:', monthTxs.length);

    // Resolve person name
    const selfPersonId = membership.person_id ?? null;
    const selfPerson = selfPersonId ? (persons || []).find(p => p.id === selfPersonId) : null;
    const personName = selfPerson?.name ?? membership.user_name ?? user.full_name ?? user.email ?? null;
    const familyName = families?.[0]?.name ?? null;

    let income = 0;
    let expenses = 0;
    for (const tx of monthTxs) {
      if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
      if (tx.type === 'income') income += tx.amount;
      else if (tx.type === 'expense') expenses += tx.amount;
    }

    console.log('[getWhatsAppContext] income:', income, 'expenses:', expenses, 'txCount:', monthTxs.length);

    // Upcoming payments in next 7 days
    const upcomingPayments = [];
    for (const sp of (scheduledArr || [])) {
      if (!sp.is_active || !sp.due_day) continue;
      const dueDate = `${currentMonth}-${String(sp.due_day).padStart(2, '0')}`;
      if (dueDate < todayISO || dueDate > next7) continue;
      upcomingPayments.push({ name: sp.name || '—', amount: sp.amount || 0, due_date: dueDate });
    }
    upcomingPayments.sort((a, b) => a.due_date.localeCompare(b.due_date));

    return Response.json({
      person_name: personName,
      family_name: familyName,
      family_id: familyId,
      person_id: selfPersonId,
      locale: 'es-MX',
      current_month: {
        period: { start: monthStart, end: todayISO },
        income,
        expenses,
        balance: income - expenses,
        transaction_count: monthTxs.length,
      },
      upcoming_payments: upcomingPayments,
    });
  } catch (error) {
    console.error('getWhatsAppContext error:', error?.message ?? error);
    return Response.json({ error: error?.message || 'internal' }, { status: 500 });
  }
});