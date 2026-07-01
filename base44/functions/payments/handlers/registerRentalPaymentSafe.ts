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

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Resolve authenticated user
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    // 2. Parse input
    const input = await req.json();
    const { property_id, month, amount, paid_by_id, payment_method_id, date_paid, notes } = input;

    if (!property_id || !month || !amount || !date_paid) {
      return Response.json({ error: 'Faltan campos requeridos: property_id, month, amount, date_paid' }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return Response.json({ error: 'El monto debe ser un número positivo.' }, { status: 400 });
    }

    // 3. Resolve approved membership (never trust client family_id)
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });
    if (!memberships.length) {
      memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: user.email,
        status: 'approved',
      });
    }
    const membership = memberships[0] || null;
    if (!membership) {
      return Response.json({ error: 'No perteneces a ninguna familia activa.' }, { status: 403 });
    }
    const familyId = membership.family_id;

    // 4. Load rental property
    let property = null;
    try {
      property = await base44.asServiceRole.entities.RentalProperty.get(property_id);
    } catch (_) {
      property = null;
    }

    // 5. Validate property exists and belongs to this family
    if (!property) {
      return Response.json({ error: 'Propiedad no encontrada.' }, { status: 404 });
    }
    if (property.family_id !== familyId) {
      return Response.json({ error: 'No tienes acceso a esta propiedad.' }, { status: 403 });
    }

    // 6. Duplicate guard
    const existingPayments = await base44.asServiceRole.entities.RentalPayment.filter({
      property_id: property.id,
      month,
    });
    const alreadyPaid = existingPayments.find(p => p.is_paid === true);
    if (alreadyPaid) {
      return Response.json({ error: 'Ya existe un cobro registrado para esta propiedad en ese mes.' }, { status: 409 });
    }

    // 7. Resolve or create "Rentas" category (backend-safe, no client permission needed)
    const allCategories = await base44.asServiceRole.entities.Category.filter({ family_id: familyId });
    let rentasCategory = allCategories.find(
      c => c.name?.toLowerCase() === 'rentas' && (c.type === 'income' || c.type === 'both')
    );
    if (!rentasCategory) {
      rentasCategory = await base44.asServiceRole.entities.Category.create({
        family_id: familyId,
        name: 'Rentas',
        icon: '🏠',
        color: '#059669',
        type: 'income',
      });
    }
    const rentasCategoryId = rentasCategory.id;

    // 8. Resolve person name from paid_by_id if provided, fallback to membership person
    let resolvedPersonName = null;
    let resolvedPersonId = paid_by_id || null;

    if (paid_by_id) {
      const persons = await base44.asServiceRole.entities.Person.filter({ family_id: familyId });
      const found = persons.find(p => p.id === paid_by_id);
      resolvedPersonName = found?.name || null;
    }

    // If still no person_id, use the membership-linked person (required by Transaction schema)
    if (!resolvedPersonId) {
      resolvedPersonId = membership.person_id || null;
    }

    // Last resort: pick the first person in the family
    if (!resolvedPersonId) {
      const allPersons = await base44.asServiceRole.entities.Person.filter({ family_id: familyId });
      resolvedPersonId = allPersons[0]?.id || null;
      if (!resolvedPersonName && allPersons[0]) resolvedPersonName = allPersons[0].name;
    }

    if (!resolvedPersonId) {
      return Response.json({ error: 'No hay personas registradas en la familia para asignar el ingreso.' }, { status: 400 });
    }

    // 9. Create RentalPayment
    const createdRentalPayment = await base44.asServiceRole.entities.RentalPayment.create({
      property_id: property.id,
      family_id: familyId,
      month,
      amount: parsedAmount,
      paid_by: resolvedPersonName || user.full_name || user.email || 'Usuario',
      payment_method_id: payment_method_id || undefined,
      date_paid,
      notes: notes || undefined,
      is_paid: true,
    });

    // 10. Create linked income Transaction (with rollback on failure)
    let createdTransaction = null;
    try {
      createdTransaction = await base44.asServiceRole.entities.Transaction.create({
        family_id: familyId,
        date: date_paid,
        type: 'income',
        amount: parsedAmount,
        description: `🏠 Renta ${property.name}${property.tenant_name ? ` · ${property.tenant_name}` : ''} (${month})`,
        category_id: rentasCategoryId,
        payment_method_id: payment_method_id || undefined,
        person_id: resolvedPersonId,
        required_type: 'Otro',
        week: getWeekNumber(date_paid),
        rental_payment_id: createdRentalPayment.id,
      });
    } catch (txError) {
      // 11. Rollback: delete rental payment if transaction fails
      console.error('[registerRentalPaymentSafe] Transaction creation failed:', txError.message, JSON.stringify(txError?.data || {}));
      try {
        await base44.asServiceRole.entities.RentalPayment.delete(createdRentalPayment.id);
        console.log('[registerRentalPaymentSafe] Rolled back RentalPayment:', createdRentalPayment.id);
      } catch (rollbackErr) {
        console.error('[registerRentalPaymentSafe] Rollback failed:', rollbackErr.message);
      }
      return Response.json({ error: 'Error al registrar el ingreso. No se guardó ningún dato.' }, { status: 500 });
    }

    // 12. Return success
    return Response.json({
      success: true,
      rental_payment_id: createdRentalPayment.id,
      transaction_id: createdTransaction.id,
      category_id: rentasCategoryId,
    });

  } catch (error) {
    console.error('[registerRentalPaymentSafe] Unexpected error:', error.message);
    return Response.json({ error: error.message || 'Error inesperado.' }, { status: 500 });
  }
}