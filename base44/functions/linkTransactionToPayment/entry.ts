import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// User-facing function — called explicitly by authenticated family members.
// Keeps user-level auth, adds family_id ownership validation to prevent
// cross-family data access (a user can only link transactions and payments
// that belong to their own family).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Authenticate the caller
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transaction_id, payment_type, payment_id } = await req.json();

    if (!transaction_id || !payment_type || !payment_id) {
      return Response.json({ error: 'Missing required fields: transaction_id, payment_type, payment_id' }, { status: 400 });
    }

    const validTypes = ['msi', 'investment', 'scheduled_payment', 'rental'];
    if (!validTypes.includes(payment_type)) {
      return Response.json({ error: `Invalid payment_type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    // 2. Use service role for entity lookups so RLS on payment sub-entities
    //    doesn't block reads, but validate family ownership explicitly below.
    const entities = base44.asServiceRole.entities;
    const userFamilyId = user.data?.family_id ?? user.data?.data?.family_id;
    const isAdmin = user.role === 'admin';

    // 3. Fetch and validate the transaction (ownership check)
    const txRecords = await entities.Transaction.filter({ id: transaction_id });
    if (!txRecords || txRecords.length === 0) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }
    const transaction = txRecords[0];
    if (!isAdmin && transaction.family_id !== userFamilyId) {
      return Response.json({ error: 'Forbidden: transaction does not belong to your family' }, { status: 403 });
    }

    // 4. Fetch the target payment entity and validate same family
    let paymentRecord = null;
    let fieldName = '';
    let entityName = '';

    if (payment_type === 'msi') {
      fieldName = 'msi_payment_id';
      entityName = 'MSIPayment';
      const records = await entities.MSIPayment.filter({ id: payment_id });
      paymentRecord = records?.[0];
    } else if (payment_type === 'investment') {
      fieldName = 'investment_payment_id';
      entityName = 'InvestmentPayment';
      const records = await entities.InvestmentPayment.filter({ id: payment_id });
      paymentRecord = records?.[0];
    } else if (payment_type === 'scheduled_payment') {
      fieldName = 'scheduled_payment_record_id';
      entityName = 'ScheduledPaymentRecord';
      const records = await entities.ScheduledPaymentRecord.filter({ id: payment_id });
      paymentRecord = records?.[0];
    } else if (payment_type === 'rental') {
      fieldName = 'rental_payment_id';
      entityName = 'RentalPayment';
      const records = await entities.RentalPayment.filter({ id: payment_id });
      paymentRecord = records?.[0];
    }

    if (!paymentRecord) {
      return Response.json({ error: `${entityName} with id ${payment_id} not found` }, { status: 404 });
    }

    // 5. Validate the payment record also belongs to the caller's family
    if (!isAdmin && paymentRecord.family_id && paymentRecord.family_id !== userFamilyId) {
      return Response.json({ error: 'Forbidden: payment does not belong to your family' }, { status: 403 });
    }

    // 6. Guard against overwriting an existing different link
    const existingFieldValue = transaction[fieldName];
    if (existingFieldValue && existingFieldValue !== payment_id) {
      return Response.json({
        error: `Transaction already linked to a different ${payment_type} payment`,
        currentPaymentId: existingFieldValue,
      }, { status: 409 });
    }

    // 7. Update the transaction with the link
    const updatedTx = await entities.Transaction.update(transaction_id, { [fieldName]: payment_id });

    return Response.json({
      success: true,
      message: `Transaction ${transaction_id} linked to ${payment_type} payment ${payment_id}`,
      transaction: updatedTx,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
