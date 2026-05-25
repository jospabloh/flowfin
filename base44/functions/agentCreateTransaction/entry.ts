import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";
import {
  AgentError,
  agentErrorResponse,
  assertBillingAllowed,
  assertRefInFamily,
  requireRole,
  resolveAgentAccess,
} from "../_agentGuard.ts";

// Creates ONE transaction for the caller's family. Identity, role and billing are
// enforced server-side; the family_id is never taken from the caller.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const access = await resolveAgentAccess(base44, req);
    await assertBillingAllowed(base44, access);
    await requireRole(base44, access, "transaction.create", "create");

    const body = await req.json().catch(() => ({}));
    const {
      amount,
      type,
      date,
      description,
      category_id,
      subcategory_id,
      payment_method_id,
    } = body;

    // person_id defaults to the caller's own person ("registra mi gasto").
    let person_id = body.person_id;
    if (!person_id || person_id === "self") person_id = access.selfPersonId;

    const missing: string[] = [];
    if (amount === undefined || amount === null) missing.push("amount");
    if (!type) missing.push("type");
    if (!date) missing.push("date");
    if (!category_id) missing.push("category_id");
    if (!person_id) missing.push("person_id");
    if (missing.length) {
      return Response.json({ error: "missing_required_fields", fields: missing }, { status: 400 });
    }
    if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
      return Response.json({ error: "invalid_amount", message: "amount must be a positive number" }, { status: 400 });
    }
    if (type !== "expense" && type !== "income") {
      return Response.json({ error: "invalid_type", message: "type must be expense or income" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: "invalid_date", message: "date must be YYYY-MM-DD" }, { status: 400 });
    }

    await Promise.all([
      assertRefInFamily(base44, access, "Category", category_id, "La categoría"),
      assertRefInFamily(base44, access, "Person", person_id, "La persona"),
      subcategory_id
        ? assertRefInFamily(base44, access, "Subcategory", subcategory_id, "La subcategoría")
        : Promise.resolve(),
      payment_method_id
        ? assertRefInFamily(base44, access, "PaymentMethod", payment_method_id, "El método de pago")
        : Promise.resolve(),
    ]);

    const txData: Record<string, unknown> = {
      family_id: access.familyId,
      amount,
      type,
      date,
      category_id,
      person_id,
    };
    if (description !== undefined && description !== null) txData.description = description;
    if (subcategory_id) txData.subcategory_id = subcategory_id;
    if (payment_method_id) txData.payment_method_id = payment_method_id;

    const created = await base44.asServiceRole.entities.Transaction.create(txData);
    return Response.json({ ok: true, id: created.id });
  } catch (error) {
    if (error instanceof AgentError) return agentErrorResponse(error);
    console.error("agentCreateTransaction error:", error);
    return Response.json({ error: (error as Error).message || "internal" }, { status: 500 });
  }
});
