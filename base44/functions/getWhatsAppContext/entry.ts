import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { resolveAccess } from '../_txAggregateHelper.ts';

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let access;
    try {
      access = await resolveAccess(base44, undefined);
    } catch (e: any) {
      if (e.httpStatus === 401 || e.code === 'not_linked') {
        return Response.json(
          {
            error: 'not_linked',
            message:
              'Tu sesión de WhatsApp no está vinculada. Abre FlowFin y toca el botón de WhatsApp para reconectarte.',
          },
          { status: 401 },
        );
      }
      throw e;
    }

    const { user, familyId, selfPersonId, membership } = access;
    const entities = base44.asServiceRole.entities;

    const today = new Date();
    const todayISO = toISODate(today);
    const monthStart = toISODate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
    const next7 = toISODate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));

    // [DEBUG-TX] temporary diagnostic — remove after root cause found
    console.log('[DEBUG-TX] getWhatsAppContext — resolved familyId:', familyId, 'selfPersonId:', selfPersonId ?? null);
    const txFilter = { family_id: familyId, date: { $gte: monthStart, $lte: todayISO } };
    console.log('[DEBUG-TX] getWhatsAppContext — Transaction filter:', JSON.stringify(txFilter));
    console.log('[DEBUG-TX] getWhatsAppContext — monthStart:', monthStart, 'todayISO:', todayISO);

    // [DEBUG-TX] control query 1: family only, no date/type
    try {
      const ctrl1 = await entities.Transaction.filter({ family_id: familyId });
      console.log('[DEBUG-TX] control1 (family only, no date/type) count:', (ctrl1 || []).length);
    } catch (e: any) {
      console.log('[DEBUG-TX] control1 error:', e?.message ?? String(e));
    }

    // [DEBUG-TX] control query 2: family + type=expense, no date
    try {
      const ctrl2 = await entities.Transaction.filter({ family_id: familyId, type: 'expense' });
      console.log('[DEBUG-TX] control2 (family + type=expense, no date) count:', (ctrl2 || []).length);
    } catch (e: any) {
      console.log('[DEBUG-TX] control2 error:', e?.message ?? String(e));
    }

    // [DEBUG-TX] control query 3: alternate suffix date syntax
    try {
      const ctrl3Filter = { family_id: familyId, date_gte: monthStart, date_lte: todayISO };
      const ctrl3 = await entities.Transaction.filter(ctrl3Filter);
      console.log('[DEBUG-TX] control3 (suffix date_gte/date_lte) filter:', JSON.stringify(ctrl3Filter), 'count:', (ctrl3 || []).length);
    } catch (e: any) {
      console.log('[DEBUG-TX] control3 error:', e?.message ?? String(e));
    }

    // Parallel minimal fetches
    const [familyArr, personArr, txArr, scheduledArr] = await Promise.all([
      entities.Family.filter({ id: familyId }),
      selfPersonId ? entities.Person.filter({ id: selfPersonId, family_id: familyId }) : Promise.resolve([]),
      (async () => {
        try {
          const result = await entities.Transaction.filter(
            txFilter,
            '-date',
            200,
            0,
          );
          // [DEBUG-TX] log real query result
          console.log('[DEBUG-TX] real Transaction query (date range) returned:', (result || []).length, 'rows');
          return result;
        } catch (e: any) {
          console.log('[DEBUG-TX] real Transaction query error:', e?.message ?? String(e));
          return [];
        }
      })(),
      (async () => {
        try {
          return await entities.ScheduledPayment.filter({ family_id: familyId, is_active: true });
        } catch {
          return [];
        }
      })(),
    ]);

    const fam = (familyArr || [])[0] ?? {};
    const person = (personArr || [])[0] ?? null;

    // Current month totals
    let income = 0;
    let expenses = 0;
    for (const tx of (txArr || [])) {
      if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
      if (tx.type === 'income') income += tx.amount;
      else if (tx.type === 'expense') expenses += tx.amount;
    }

    // [DEBUG-TX] temporary diagnostic — remove after root cause found
    console.log('[DEBUG-TX] getWhatsAppContext — current_month totals — income:', income, 'expenses:', expenses, 'txArr count:', (txArr || []).length);

    // Upcoming payments (next 7 days)
    const currentMonth = todayISO.slice(0, 7);
    const upcomingPayments = [];
    for (const sp of (scheduledArr || [])) {
      if (!sp.is_active || !sp.due_day) continue;
      const dueDate = `${currentMonth}-${String(sp.due_day).padStart(2, '0')}`;
      if (dueDate < todayISO || dueDate > next7) continue;
      upcomingPayments.push({
        name: sp.name || sp.description || '—',
        amount: sp.amount || 0,
        due_date: dueDate,
      });
    }
    upcomingPayments.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));

    return Response.json({
      person_name: person?.name ?? membership?.user_name ?? user?.full_name ?? user?.email ?? null,
      family_name: fam.name ?? null,
      family_id: familyId,
      person_id: selfPersonId ?? null,
      locale: 'es-MX',
      current_month: {
        period: { start: monthStart, end: todayISO },
        income,
        expenses,
        balance: income - expenses,
      },
      upcoming_payments: upcomingPayments,
    });
  } catch (error: any) {
    console.error('getWhatsAppContext error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: error.httpStatus || 500 });
  }
});
