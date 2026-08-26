import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Entity hook — triggered by Base44 when InvestmentPayment is created.
// Uses asServiceRole for all DB operations (hook runs in system context,
// not tied to any specific user session).
//
// ⚠️ INTENTIONALLY INERT — do not "fix" the empty ids below.
// The `category_id: ''` / `person_id: ''` literals mean the guard further down
// always returns early, so this hook has never created a single movement (0 rows
// in production carry one). That is not a bug to repair: `Investments.jsx` (which sets investment_payment_id directly) already creates
// the movement itself, and wiring real values in here would double-count every
// payment. Kept deployed only because the entity hook is still registered in the
// Base44 panel — removing it means unregistering it there first, then redeploying
// with --force. Track that as its own task; see CLAUDE.md.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const entities = base44.asServiceRole.entities;

    const { event, data } = await req.json();

    if (!data || event?.type !== 'create') {
      return Response.json({ message: 'Event not applicable' }, { status: 200 });
    }

    const investmentPayment = data;

    // Buscar la Inversión para obtener datos
    const investmentRecords = await entities.Investment.filter({
      id: investmentPayment.investment_id,
    });
    if (!investmentRecords || investmentRecords.length === 0) {
      return Response.json({ error: 'Investment not found' }, { status: 404 });
    }

    const investment = investmentRecords[0];

    // Verificar si ya existe una Transaction vinculada
    const existingTx = await entities.Transaction.filter({
      investment_payment_id: investmentPayment.id,
    });
    if (existingTx && existingTx.length > 0) {
      return Response.json({ message: 'Transaction already linked' }, { status: 200 });
    }

    // Crear Transaction de egreso para el pago de inversión
    const txData = {
      family_id: investment.family_id,
      date: investmentPayment.date || new Date().toISOString().split('T')[0],
      type: 'expense',
      amount: investmentPayment.amount,
      description: `Pago Inversión ${investment.name} - Cuota ${investmentPayment.payment_number}`,
      category_id: '', // Usuario asignará
      person_id: '',   // Usuario asignará
      payment_method_id: '',
      notes: `Vinculado a inversión: ${investment.name}`,
      investment_payment_id: investmentPayment.id,
      required_type: 'Inversión',
    };

    // Solo crear si tenemos category_id y person_id
    if (!txData.category_id || !txData.person_id) {
      return Response.json({ message: 'Missing category or person, skipping auto-creation' }, { status: 200 });
    }

    const newTx = await entities.Transaction.create(txData);

    return Response.json({
      success: true,
      transactionId: newTx.id,
      investmentPaymentId: investmentPayment.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
