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
    } catch {
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

// Returns the family's catalogs (persons, categories, subcategories, payment
// methods) for the assistant to map names → ids. Identity is resolved server-side
// by the guard; no family_id is accepted from the caller.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const access = await resolveAgentAccess(base44, req);
    const familyId = access.familyId;
    const entities = base44.asServiceRole.entities;

    const [persons, categories, subcategories, paymentMethods] = await Promise.all([
      entities.Person.filter({ family_id: familyId }),
      entities.Category.filter({ family_id: familyId }),
      entities.Subcategory.filter({ family_id: familyId }),
      entities.PaymentMethod.filter({ family_id: familyId }),
    ]);

    return Response.json({
      family_id: familyId,
      self_person_id: access.selfPersonId,
      persons: (persons || []).map((p: Record<string, unknown>) => ({ id: p.id, name: p.name })),
      categories: (categories || []).map((c: Record<string, unknown>) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        icon: c.icon,
      })),
      subcategories: (subcategories || []).map((s: Record<string, unknown>) => ({
        id: s.id,
        name: s.name,
        category_id: s.category_id,
      })),
      payment_methods: (paymentMethods || []).map((m: Record<string, unknown>) => ({
        id: m.id,
        name: m.name,
        type: m.type,
      })),
    });
  } catch (error) {
    if (error instanceof AgentError) return agentErrorResponse(error);
    console.error("agentGetCatalogs error:", error);
    return Response.json({ error: (error as Error).message || "internal" }, { status: 500 });
  }
});
