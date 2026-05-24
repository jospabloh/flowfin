import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function resolveAccess(base44, bodyFamilyId) {
  const entities = base44.asServiceRole.entities;

  // Try user session first (app web)
  let user = null;
  try { user = await base44.auth.me(); } catch { user = null; }

  if (user) {
    let memberships = await entities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships || memberships.length === 0) {
      memberships = await entities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    }
    const membership = (memberships || [])[0] ?? null;
    if (!membership) {
      const err = new Error('No approved family membership found');
      err.httpStatus = 401;
      err.code = 'not_linked';
      throw err;
    }
    return { user, familyId: membership.family_id, selfPersonId: membership.person_id ?? null, membership };
  }

  // Fallback: agent calling from WhatsApp passes familyId explicitly
  if (bodyFamilyId) {
    try {
      const family = await entities.Family.get(bodyFamilyId);
      if (!family) {
        const err = new Error('Family not found');
        err.httpStatus = 403;
        throw err;
      }
    } catch (e) {
      const err = new Error('Family not found');
      err.httpStatus = 403;
      throw err;
    }
    return { user: null, familyId: bodyFamilyId, selfPersonId: null, membership: null };
  }

  const err = new Error('not_linked');
  err.httpStatus = 401;
  err.code = 'not_linked';
  throw err;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Parse body first so we can pass familyId to resolveAccess
    let body = {};
    try { body = await req.json(); } catch { body = {}; }

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

    const { familyId } = access;
    const entities = base44.asServiceRole.entities;

    const [personsArr, categoriesArr, subcategoriesArr, paymentMethodsArr] = await Promise.all([
      entities.Person.filter({ family_id: familyId }),
      entities.Category.filter({ family_id: familyId }),
      entities.Subcategory.filter({ family_id: familyId }),
      entities.PaymentMethod.filter({ family_id: familyId }),
    ]);

    return Response.json({
      family_id: familyId,
      persons: (personsArr || []).map((p) => ({ id: p.id, name: p.name })),
      categories: (categoriesArr || []).map((c) => ({ id: c.id, name: c.name, type: c.type, icon: c.icon })),
      subcategories: (subcategoriesArr || []).map((s) => ({ id: s.id, name: s.name, category_id: s.category_id })),
      payment_methods: (paymentMethodsArr || []).map((m) => ({ id: m.id, name: m.name, type: m.type })),
    });
  } catch (error) {
    console.error('agentGetCatalogs error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: error.httpStatus || 500 });
  }
});