import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";
import { AgentError, agentErrorResponse, READABLE_ENTITIES, resolveAgentAccess, scopeFilter } from "../_agentGuard.ts";

const MAX_LIMIT = 50;

// Keeps only primitive equality filters (drops operators/objects/arrays) so the
// query stays simple and can never escape the family scope forced below.
function flatFilter(input: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (k.startsWith("$") || k === "family_id") continue;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") out[k] = v;
  }
  return out;
}

// Generic read over the caller's tenant. The server forces family_id on every
// query and restricts the entity to a read allow-list.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const access = await resolveAgentAccess(base44, req);

    const body = await req.json().catch(() => ({}));
    const entity = String(body.entity || "");
    if (!READABLE_ENTITIES.has(entity)) {
      return Response.json({ error: "entity_not_allowed", message: `No puedo consultar ${entity}.` }, { status: 400 });
    }

    const filter = scopeFilter(access, flatFilter(body.filter));
    const sort = typeof body.sort === "string" && body.sort ? body.sort : "-created_date";
    let limit = Number(body.limit);
    if (!isFinite(limit) || limit <= 0) limit = 20;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const rows = await base44.asServiceRole.entities[entity].filter(filter, sort, limit);
    return Response.json({ entity, count: (rows || []).length, items: rows || [] });
  } catch (error) {
    if (error instanceof AgentError) return agentErrorResponse(error);
    console.error("agentQuery error:", error);
    return Response.json({ error: (error as Error).message || "internal" }, { status: 500 });
  }
});
