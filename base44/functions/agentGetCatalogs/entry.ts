import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { AgentError, agentErrorResponse, resolveAgentAccess } from '../_agentGuard.ts';

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
