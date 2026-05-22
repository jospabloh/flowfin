import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { guardInternal } from '../_internalGuard.ts';

const todayIso = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const denied = await guardInternal(base44, req);
    if (denied) return denied;

    const month = currentMonth();
    const today = new Date();
    const activeScheduledPayments = await base44.asServiceRole.entities.ScheduledPayment.filter({
      is_active: true,
      automation_mode: 'auto',
      autopost_enabled: true,
    });

    let createdRecords = 0;
    let updatedRecords = 0;
    let createdTransactions = 0;

    for (const scheduledPayment of activeScheduledPayments || []) {
      const dueDay = Number(scheduledPayment.due_day || 1);
      const tolerance = Math.max(0, Math.min(3, Number(scheduledPayment.autopost_day_tolerance || 0)));
      if (today.getDate() + tolerance < dueDay) continue;

      const existingRecords = await base44.asServiceRole.entities.ScheduledPaymentRecord.filter({
        scheduled_payment_id: scheduledPayment.id,
        month,
      });

      const baseRecord = {
        family_id: scheduledPayment.family_id,
        month,
        paid_date: todayIso(),
        amount_paid: Number(scheduledPayment.amount || 0),
        notes: `Autopost ${month}${scheduledPayment.match_hint ? ` · hint:${scheduledPayment.match_hint}` : ''}`,
        paid_by: 'Sistema (auto)',
      };

      let record = existingRecords?.[0];
      if (!record) {
        record = await base44.asServiceRole.entities.ScheduledPaymentRecord.create({
          ...baseRecord,
          scheduled_payment_id: scheduledPayment.id,
        });
        createdRecords += 1;
      } else {
        record = await base44.asServiceRole.entities.ScheduledPaymentRecord.update(record.id, baseRecord);
        updatedRecords += 1;
      }

      const tx = await base44.asServiceRole.entities.Transaction.filter({ scheduled_payment_record_id: record.id });
      if (!tx?.length) {
        const persons = await base44.asServiceRole.entities.Person.filter({ family_id: scheduledPayment.family_id });
        const fallbackPersonId = persons?.[0]?.id;
        if (!scheduledPayment.category_id || !fallbackPersonId || !scheduledPayment.payment_method_id) continue;

        await base44.asServiceRole.entities.Transaction.create({
          family_id: scheduledPayment.family_id,
          date: baseRecord.paid_date,
          type: 'expense',
          amount: baseRecord.amount_paid,
          description: `${scheduledPayment.icon || '📅'} ${scheduledPayment.name}`,
          category_id: scheduledPayment.category_id,
          person_id: fallbackPersonId,
          payment_method_id: scheduledPayment.payment_method_id,
          notes: `Creado automáticamente (${month})`,
          scheduled_payment_record_id: record.id,
        });
        createdTransactions += 1;
      }
    }

    return Response.json({
      ok: true,
      month,
      createdRecords,
      updatedRecords,
      createdTransactions,
      idempotency_key: 'scheduled_payment_id+month',
    });
  } catch (error) {
    console.error('[autoPostScheduledPayments]', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
});
