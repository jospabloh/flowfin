import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";
import {
  AgentError,
  agentErrorResponse,
  assertBillingAllowed,
  assertRefInFamily,
  requireRole,
  resolveAgentAccess,
  sanitizeWriteData,
} from "../_agentGuard.ts";

const WRITE_FIELDS = new Set([
  "amount",
  "type",
  "date",
  "description",
  "category_id",
  "subcategory_id",
  "person_id",
  "payment_method_id",
  "notes",
  "required_type",
]);

// Updates an existing transaction that belongs to the caller's family.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const access = await resolveAgentAccess(base44, req);
    await assertBillingAllowed(base44, access);
    await requireRole(base44, access, "transaction.edit", "modify");

    const body = await req.json().catch(() => ({}));
    const id = body.id;
    if (!id) return Response.json({ error: "missing_required_fields", fields: ["id"] }, { status: 400 });

    await assertRefInFamily(base44, access, "Transaction", String(id), "El movimiento");

    const data = sanitizeWriteData(body, WRITE_FIELDS);
    if (Object.keys(data).length === 0) {
      return Response.json({ error: "no_updatable_fields" }, { status: 400 });
    }
    if (data.amount !== undefined) {
      const amt = data.amount;
      if (typeof amt !== "number" || !isFinite(amt) || amt <= 0) {
        return Response.json({ error: "invalid_amount" }, { status: 400 });
      }
    }
    if (data.type !== undefined && data.type !== "expense" && data.type !== "income") {
      return Response.json({ error: "invalid_type" }, { status: 400 });
    }
    if (data.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.date))) {
      return Response.json({ error: "invalid_date" }, { status: 400 });
    }

    const refChecks: Promise<void>[] = [];
    if (data.category_id) refChecks.push(assertRefInFamily(base44, access, "Category", String(data.category_id), "La categoría"));
    if (data.person_id) refChecks.push(assertRefInFamily(base44, access, "Person", String(data.person_id), "La persona"));
    if (data.subcategory_id) refChecks.push(assertRefInFamily(base44, access, "Subcategory", String(data.subcategory_id), "La subcategoría"));
    if (data.payment_method_id) refChecks.push(assertRefInFamily(base44, access, "PaymentMethod", String(data.payment_method_id), "El método de pago"));
    await Promise.all(refChecks);

    await base44.asServiceRole.entities.Transaction.update(String(id), data);
    return Response.json({ ok: true, id });
  } catch (error) {
    if (error instanceof AgentError) return agentErrorResponse(error);
    console.error("agentUpdateTransaction error:", error);
    return Response.json({ error: (error as Error).message || "internal" }, { status: 500 });
  }
});
