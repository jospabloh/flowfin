import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Returns upcoming scheduled payments for the next 30 days.
// Resolves family_id server-side from authenticated session.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const srEntities = base44.asServiceRole.entities;
    const userEntities = base44.entities;

    let memberships = await srEntities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) memberships = await srEntities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    if (!memberships.length) return Response.json({ error: 'forbidden' }, { status: 403 });

    const activeId = user.data?.family_id ?? user.data?.data?.family_id;
    const membership = memberships.find(m => m.family_id === activeId)
      ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
    const familyId = membership.family_id;

    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const cutoff30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const currentMonth = todayISO.slice(0, 7);

    // Use user-scoped entities — asServiceRole returns empty for family-scoped entities
    const [scheduledArr, paidRecordsArr] = await Promise.all([
      userEntities.ScheduledPayment.filter({ family_id: familyId, is_active: true }).catch(() => []),
      userEntities.ScheduledPaymentRecord.filter({ family_id: familyId, month: currentMonth }).catch(() => []),
    ]);

    const paidIds = new Set((paidRecordsArr || []).map(r => r.scheduled_payment_id));

    const upcoming = [];
    for (const sp of (scheduledArr || [])) {
      if (!sp.is_active || !sp.due_day) continue;
      const dueDate = `${currentMonth}-${String(sp.due_day).padStart(2, '0')}`;
      const status = paidIds.has(sp.id) ? 'pagado' : dueDate < todayISO ? 'vencido' : 'pendiente';
      if (dueDate > cutoff30) continue;
      const isOverdue = dueDate < todayISO && status !== 'pagado';
      upcoming.push({
        name: sp.name || sp.description || '—',
        amount: sp.amount || 0,
        due_date: dueDate,
        status,
        is_overdue: isOverdue,
        risk: isOverdue ? 'Vencido — registra o revisa este pago.' : null,
      });
    }

    upcoming.sort((a, b) => a.due_date < b.due_date ? -1 : 1);

    return Response.json({
      upcoming_payments: upcoming,
      total_pending: upcoming.filter(p => p.status === 'pendiente').length,
      total_overdue: upcoming.filter(p => p.status === 'vencido').length,
      period: { start: todayISO, end: cutoff30 },
    });
  } catch (error) {
    console.error('finiaGetUpcomingPayments error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});