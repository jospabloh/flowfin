import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { resolveAccess } from '../_txAggregateHelper.ts';

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

    const { familyId } = access;

    const body = await req.json();
    const {
      amount,
      type,
      date,
      description,
      category_id,
      subcategory_id,
      person_id,
      payment_method_id,
    } = body;

    // ── Validation ────────────────────────────────────────────────────────────

    const missing: string[] = [];
    if (amount === undefined || amount === null) missing.push('amount');
    if (!type) missing.push('type');
    if (!date) missing.push('date');
    if (!category_id) missing.push('category_id');
    if (!person_id) missing.push('person_id');

    if (missing.length > 0) {
      return Response.json(
        { error: 'missing_required_fields', fields: missing },
        { status: 400 },
      );
    }

    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return Response.json(
        { error: 'invalid_amount', message: 'amount must be a finite number greater than 0' },
        { status: 400 },
      );
    }

    if (type !== 'expense' && type !== 'income') {
      return Response.json(
        { error: 'invalid_type', message: "type must be 'expense' or 'income'" },
        { status: 400 },
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json(
        { error: 'invalid_date', message: 'date must be in YYYY-MM-DD format' },
        { status: 400 },
      );
    }

    // ── Cross-tenant guard ────────────────────────────────────────────────────
    // For every provided id, verify the record exists and belongs to this family.

    const entities = base44.asServiceRole.entities;

    const checks: Array<Promise<void>> = [];

    checks.push((async () => {
      const rows = await entities.Category.filter({ id: category_id, family_id: familyId });
      if (!rows || rows.length === 0) {
        const err: any = new Error('category_id does not belong to this family or does not exist');
        err.httpStatus = 403;
        throw err;
      }
    })());

    checks.push((async () => {
      const rows = await entities.Person.filter({ id: person_id, family_id: familyId });
      if (!rows || rows.length === 0) {
        const err: any = new Error('person_id does not belong to this family or does not exist');
        err.httpStatus = 403;
        throw err;
      }
    })());

    if (subcategory_id) {
      checks.push((async () => {
        const rows = await entities.Subcategory.filter({ id: subcategory_id, family_id: familyId });
        if (!rows || rows.length === 0) {
          const err: any = new Error('subcategory_id does not belong to this family or does not exist');
          err.httpStatus = 403;
          throw err;
        }
      })());
    }

    if (payment_method_id) {
      checks.push((async () => {
        const rows = await entities.PaymentMethod.filter({ id: payment_method_id, family_id: familyId });
        if (!rows || rows.length === 0) {
          const err: any = new Error('payment_method_id does not belong to this family or does not exist');
          err.httpStatus = 403;
          throw err;
        }
      })());
    }

    try {
      await Promise.all(checks);
    } catch (e: any) {
      return Response.json({ error: e.message || 'forbidden' }, { status: e.httpStatus || 403 });
    }

    // ── Create transaction ────────────────────────────────────────────────────
    // family_id is always taken from the server-resolved access, never from the body.

    const txData: Record<string, unknown> = {
      family_id: familyId,
      amount,
      type,
      date,
      category_id,
      person_id,
    };

    if (description !== undefined && description !== null) txData.description = description;
    if (subcategory_id) txData.subcategory_id = subcategory_id;
    if (payment_method_id) txData.payment_method_id = payment_method_id;

    const created = await entities.Transaction.create(txData);

    return Response.json({ ok: true, id: created.id });
  } catch (error: any) {
    console.error('agentCreateTransaction error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: error.httpStatus || 500 });
  }
});
