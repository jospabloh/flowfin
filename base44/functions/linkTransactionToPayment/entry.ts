import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transaction_id, payment_type, payment_id } = await req.json();

    if (!transaction_id || !payment_type || !payment_id) {
      return Response.json({ error: 'Missing required fields: transaction_id, payment_type, payment_id' }, { status: 400 });
    }

    // Validar payment_type
    const validTypes = ['msi', 'investment', 'scheduled_payment', 'rental'];
    if (!validTypes.includes(payment_type)) {
      return Response.json({ error: `Invalid payment_type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    // Buscar la Transaction
    const txRecords = await base44.entities.Transaction.filter({ id: transaction_id });
    if (!txRecords || txRecords.length === 0) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const transaction = txRecords[0];

    // Validar que el pago especializado existe según el tipo
    let paymentRecord = null;
    let fieldName = '';
    let entityName = '';

    if (payment_type === 'msi') {
      fieldName = 'msi_payment_id';
      entityName = 'MSIPayment';
      const records = await base44.entities.MSIPayment.filter({ id: payment_id });
      paymentRecord = records?.[0];
    } else if (payment_type === 'investment') {
      fieldName = 'investment_payment_id';
      entityName = 'InvestmentPayment';
      const records = await base44.entities.InvestmentPayment.filter({ id: payment_id });
      paymentRecord = records?.[0];
    } else if (payment_type === 'scheduled_payment') {
      fieldName = 'scheduled_payment_record_id';
      entityName = 'ScheduledPaymentRecord';
      const records = await base44.entities.ScheduledPaymentRecord.filter({ id: payment_id });
      paymentRecord = records?.[0];
    } else if (payment_type === 'rental') {
      fieldName = 'rental_payment_id';
      entityName = 'RentalPayment';
      const records = await base44.entities.RentalPayment.filter({ id: payment_id });
      paymentRecord = records?.[0];
    }

    if (!paymentRecord) {
      return Response.json({ error: `${entityName} with id ${payment_id} not found` }, { status: 404 });
    }

    // Verificar si ya hay otro pago vinculado
    const existingFieldValue = transaction[fieldName];
    if (existingFieldValue && existingFieldValue !== payment_id) {
      return Response.json({ 
        error: `Transaction already linked to a different ${payment_type} payment`, 
        currentPaymentId: existingFieldValue 
      }, { status: 409 });
    }

    // Actualizar la Transaction con el vínculo
    const updateData = {
      [fieldName]: payment_id
    };

    const updatedTx = await base44.entities.Transaction.update(transaction_id, updateData);

    return Response.json({
      success: true,
      message: `Transaction ${transaction_id} linked to ${payment_type} payment ${payment_id}`,
      transaction: updatedTx
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});