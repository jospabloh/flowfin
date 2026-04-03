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

    const msiPayment = data;
    
    // Buscar el MSI para obtener datos
    const msiRecords = await base44.entities.MSI.filter({ id: msiPayment.msi_id });
    if (!msiRecords || msiRecords.length === 0) {
      return Response.json({ error: 'MSI not found' }, { status: 404 });
    }

    const msi = msiRecords[0];
    
    // Verificar si ya existe una Transaction vinculada
    const existingTx = await base44.entities.Transaction.filter({
      msi_payment_id: msiPayment.id,
    });

    if (existingTx && existingTx.length > 0) {
      return Response.json({ message: 'Transaction already linked' }, { status: 200 });
    }

    // Crear Transaction de egreso para el pago MSI
    const txData = {
      family_id: msi.family_id,
      date: msiPayment.paid_date || new Date().toISOString().split('T')[0],
      type: 'expense',
      amount: msiPayment.amount,
      description: `Pago MSI ${msi.store} - Mes ${msiPayment.month_number}`,
      category_id: msi.category_id || '',
      person_id: '', // El usuario asignará
      payment_method_id: msi.payment_method_id || '',
      notes: `Vinculado a pago MSI: ${msi.concept}`,
      msi_payment_id: msiPayment.id,
    };

    // Solo crear si tenemos category_id y person_id
    if (!txData.category_id || !txData.person_id) {
      return Response.json({ message: 'Missing category or person, skipping auto-creation' }, { status: 200 });
    }

    const newTx = await base44.entities.Transaction.create(txData);
    
    return Response.json({ 
      success: true,
      transactionId: newTx.id,
      msiPaymentId: msiPayment.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});