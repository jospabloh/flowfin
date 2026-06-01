import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";
import {
  AgentError,
  agentErrorResponse,
  assertBillingAllowed,
  assertRefInFamily,
  requireRole,
  resolveAgentAccess,
} from "../_agentGuard.ts";

// Deletes a transaction that belongs to the caller's family.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const access = await resolveAgentAccess(base44, req);
    await assertBillingAllowed(base44, access);
    await requireRole(base44, access, "transaction.delete", "delete");

    const body = await req.json().catch(() => ({}));
    const id = body.id;
    if (!id) return Response.json({ error: "missing_required_fields", fields: ["id"] }, { status: 400 });

    await assertRefInFamily(base44, access, "Transaction", String(id), "El movimiento");
    await base44.asServiceRole.entities.Transaction.delete(String(id));
    return Response.json({ ok: true, id });
  } catch (error) {
    if (error instanceof AgentError) return agentErrorResponse(error);
    console.error("agentDeleteTransaction error:", error);
    return Response.json({ error: (error as Error).message || "internal" }, { status: 500 });
  }
});
