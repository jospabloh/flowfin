import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getWeekNumber(dateStr) {
  try {
    const date = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  } catch { return 1; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event, data } = await req.json();
    
    if (!data || event.type !== 'create') {
      return Response.json({ message: 'Event not applicable' }, { status: 200 });
    }

    const scheduledPaymentRecord = data;
    
    // Fetch ScheduledPayment details
    const scheduledPaymentRecords = await base44.asServiceRole.entities.ScheduledPayment.filter({ 
      id: scheduledPaymentRecord.scheduled_payment_id,
    });
    if (!scheduledPaymentRecords || scheduledPaymentRecords.length === 0) {
      return Response.json({ error: 'ScheduledPayment not found' }, { status: 404 });
    }

    const scheduledPayment = scheduledPaymentRecords[0];
    
    // Check for duplicate transaction
    const existingTx = await base44.asServiceRole.entities.Transaction.filter({
      scheduled_payment_record_id: scheduledPaymentRecord.id,
    });

    if (existingTx && existingTx.length > 0) {
      return Response.json({ message: 'Transaction already linked' }, { status: 200 });
    }

    // Resolve person_id: use paid_by if available as a hint, fallback to primary person or first person
    let resolvedPersonId = null;
    if (scheduledPayment.family_id) {
      const persons = await base44.asServiceRole.entities.Person.filter({ 
        family_id: scheduledPayment.family_id 
      });
      if (persons && persons.length > 0) {
        // First try to find by name/email match with paid_by
        if (scheduledPaymentRecord.paid_by && persons.length > 0) {
          const paidByLower = scheduledPaymentRecord.paid_by.toLowerCase();
          const matched = persons.find(p => p.name && p.name.toLowerCase().includes(paidByLower));
          if (matched) {
            resolvedPersonId = matched.id;
          }
        }
        // Fallback: use first person
        if (!resolvedPersonId) {
          resolvedPersonId = persons[0].id;
        }
      }
    }

    // Build transaction data
    const txData = {
      family_id: scheduledPaymentRecord.family_id,
      date: scheduledPaymentRecord.paid_date || new Date().toISOString().split('T')[0],
      type: 'expense',
      amount: scheduledPaymentRecord.amount_paid || scheduledPayment.amount || 0,
      description: scheduledPayment.name || 'Pago programado',
      category_id: scheduledPayment.category_id || '',
      person_id: resolvedPersonId || '',
      payment_method_id: scheduledPayment.payment_method_id || '',
      notes: `Pago programado: ${scheduledPayment.name}. Registrado por: ${scheduledPaymentRecord.paid_by || 'Sistema'}${scheduledPaymentRecord.notes ? '. ' + scheduledPaymentRecord.notes : ''}`,
      scheduled_payment_record_id: scheduledPaymentRecord.id,
      week: getWeekNumber(scheduledPaymentRecord.paid_date),
    };

    // Only create if we have category_id and person_id
    if (!txData.category_id || !txData.person_id) {
      return Response.json({ 
        message: 'Missing category_id or person_id, skipping auto-creation',
        missing: {
          category_id: !txData.category_id,
          person_id: !txData.person_id,
        }
      }, { status: 200 });
    }

    const newTx = await base44.asServiceRole.entities.Transaction.create(txData);
    
    return Response.json({ 
      success: true,
      transactionId: newTx.id,
      scheduledPaymentRecordId: scheduledPaymentRecord.id,
      message: `Transaction created for scheduled payment "${scheduledPayment.name}"`,
    });
  } catch (error) {
    console.error('[createTransactionFromScheduledPaymentRecord]', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
});