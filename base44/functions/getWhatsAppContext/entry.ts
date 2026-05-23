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

    // Parallel minimal fetches
    const [familyArr, personArr, txArr, scheduledArr] = await Promise.all([
      entities.Family.filter({ id: familyId }),
      selfPersonId ? entities.Person.filter({ id: selfPersonId, family_id: familyId }) : Promise.resolve([]),
      (async () => {
        try {
          return await entities.Transaction.filter(
            { family_id: familyId, date: { $gte: monthStart, $lte: todayISO } },
            '-date',
            200,
            0,
          );
        } catch {
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
