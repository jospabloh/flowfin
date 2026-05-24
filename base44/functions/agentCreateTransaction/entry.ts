import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function resolveAccess(base44, bodyFamilyId) {
  const entities = base44.asServiceRole.entities;

  // Try user session first (app web)
  let user = null;
  try { user = await base44.auth.me(); } catch { user = null; }

  if (user) {
    // If user is a platform admin (role === 'admin') and a family_id was provided,
    // treat it as an agent/WhatsApp call — skip cross-tenant guard.
    if (user.role === 'admin' && bodyFamilyId) {
      return { user, familyId: bodyFamilyId, selfPersonId: null, hasUserSession: false };
    }

    let memberships = await entities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships || memberships.length === 0) {
      memberships = await entities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    }
    const membership = (memberships || [])[0] ?? null;
    if (!membership) {
      // Regular user with no family — could be agent calling with explicit family_id
      if (bodyFamilyId) {
        return { user, familyId: bodyFamilyId, selfPersonId: null, hasUserSession: false };
      }
      const err = new Error('No approved family membership found');
      err.httpStatus = 401;
      err.code = 'not_linked';
      throw err;
    }
    // Use the family from membership (ignore body.family_id for security)
    return { user, familyId: membership.family_id, selfPersonId: membership.person_id ?? null, hasUserSession: true };
  }

  // Fallback: agent calling from WhatsApp — family_id comes pre-verified from getWhatsAppContext
  if (bodyFamilyId) {
    return { user: null, familyId: bodyFamilyId, selfPersonId: null, hasUserSession: false };
  }

  const err = new Error('not_linked');
  err.httpStatus = 401;
  err.code = 'not_linked';
  throw err;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();

    let access;
    try {
      access = await resolveAccess(base44, body.family_id);
    } catch (e) {
      if (e.httpStatus === 401 || e.code === 'not_linked') {
        return Response.json(
          { error: 'not_linked', message: 'Tu sesión de WhatsApp no está vinculada. Abre FlowFin y toca el botón de WhatsApp para reconectarte.' },
          { status: 401 },
        );
      }
      throw e;
    }

    const { familyId, hasUserSession } = access;
    const { amount, type, date, description, category_id, subcategory_id, person_id, payment_method_id } = body;

    // ── Basic validation ───────────────────────────────────────────────────
    const missing = [];
    if (amount === undefined || amount === null) missing.push('amount');
    if (!type) missing.push('type');
    if (!date) missing.push('date');
    if (!category_id) missing.push('category_id');
    if (!person_id) missing.push('person_id');

    if (missing.length > 0) {
      return Response.json({ error: 'missing_required_fields', fields: missing }, { status: 400 });
    }

    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return Response.json({ error: 'invalid_amount', message: 'amount must be a finite number greater than 0' }, { status: 400 });
    }

    if (type !== 'expense' && type !== 'income') {
      return Response.json({ error: 'invalid_type', message: "type must be 'expense' or 'income'" }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: 'invalid_date', message: 'date must be in YYYY-MM-DD format' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;

    // ── Cross-tenant guard (only when we have a real user session) ─────────
    // When called from WhatsApp without a user session, family_id is pre-verified
    // by getWhatsAppContext, and IDs come from agentGetCatalogs (same family).
    if (hasUserSession) {
      const checks = [];

      checks.push((async () => {
        try {
          const cat = await entities.Category.get(category_id);
          if (!cat || cat.family_id !== familyId) throw new Error('forbidden');
        } catch {
          const err = new Error('category_id does not belong to this family or does not exist');
          err.httpStatus = 403;
          throw err;
        }
      })());

      checks.push((async () => {
        try {
          const person = await entities.Person.get(person_id);
          if (!person || person.family_id !== familyId) throw new Error('forbidden');
        } catch {
          const err = new Error('person_id does not belong to this family or does not exist');
          err.httpStatus = 403;
          throw err;
        }
      })());

      if (subcategory_id) {
        checks.push((async () => {
          try {
            const sub = await entities.Subcategory.get(subcategory_id);
            if (!sub || sub.family_id !== familyId) throw new Error('forbidden');
          } catch {
            const err = new Error('subcategory_id does not belong to this family or does not exist');
            err.httpStatus = 403;
            throw err;
          }
        })());
      }

      if (payment_method_id) {
        checks.push((async () => {
          try {
            const pm = await entities.PaymentMethod.get(payment_method_id);
            if (!pm || pm.family_id !== familyId) throw new Error('forbidden');
          } catch {
            const err = new Error('payment_method_id does not belong to this family or does not exist');
            err.httpStatus = 403;
            throw err;
          }
        })());
      }

      try {
        await Promise.all(checks);
      } catch (e) {
        return Response.json({ error: e.message || 'forbidden' }, { status: e.httpStatus || 403 });
      }
    }

    // ── Create transaction ─────────────────────────────────────────────────
    const txData = {
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
  } catch (error) {
    console.error('agentCreateTransaction error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: error.httpStatus || 500 });
  }
});