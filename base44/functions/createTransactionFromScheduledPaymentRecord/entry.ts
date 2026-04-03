import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
    
    // Buscar el Pago Programado para obtener datos
    const scheduledPaymentRecords = await base44.entities.ScheduledPayment.filter({ 
      id: scheduledPaymentRecord.scheduled_payment_id,
    });
    if (!scheduledPaymentRecords || scheduledPaymentRecords.length === 0) {
      return Response.json({ error: 'ScheduledPayment not found' }, { status: 404 });
    }

    const scheduledPayment = scheduledPaymentRecords[0];
    
    // Verificar si ya existe una Transaction vinculada
    const existingTx = await base44.entities.Transaction.filter({
      scheduled_payment_record_id: scheduledPaymentRecord.id,
    });

    if (existingTx && existingTx.length > 0) {
      return Response.json({ message: 'Transaction already linked' }, { status: 200 });
    }

    // Crear Transaction de egreso para el pago programado
    const txData = {
      family_id: scheduledPaymentRecord.family_id,
      date: scheduledPaymentRecord.paid_date || new Date().toISOString().split('T')[0],
      type: 'expense',
      amount: scheduledPaymentRecord.amount_paid,
      description: scheduledPayment.name,
      category_id: scheduledPayment.category_id || '',
      person_id: '', // Usuario asignará
      payment_method_id: scheduledPayment.payment_method_id || '',
      notes: `Vinculado a pago programado: ${scheduledPayment.name}. Pagado por: ${scheduledPaymentRecord.paid_by || 'No especificado'}`,
      scheduled_payment_record_id: scheduledPaymentRecord.id,
    };

    // Solo crear si tenemos category_id y person_id
    if (!txData.category_id || !txData.person_id) {
      return Response.json({ message: 'Missing category or person, skipping auto-creation' }, { status: 200 });
    }

    const newTx = await base44.entities.Transaction.create(txData);
    
    return Response.json({ 
      success: true,
      transactionId: newTx.id,
      scheduledPaymentRecordId: scheduledPaymentRecord.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});