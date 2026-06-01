// Shared server-side guard for the FlowFin AI assistant tools.
//
// Single source of truth for the assistant's security: tenant identity, role
// enforcement (mirroring the client permission registry), the billing gate, and
// entity/field allow-lists. Every agent tool must call `resolveAgentAccess`
// first, and any mutation must additionally pass `requireRole` + `assertBillingAllowed`.
//
// Identity is resolved ONLY from trusted server signals:
//   - Web / in-app SDK calls → `base44.auth.me()` → approved FamilyMembership.
//   - WhatsApp / webhook calls → see the diagnostic logging below. `auth.me()`
//     is null for webhook-origin requests, so the real identity signal is logged
//     on every call until it is confirmed and wired in (see plan Fase 0.5).
// The LLM-provided `body.family_id` is NEVER trusted for tenant resolution.

export type Capability = "view" | "create" | "modify" | "delete";

export interface AgentAccess {
  // deno-lint-ignore no-explicit-any
  user: any | null;
  familyId: string;
  selfPersonId: string | null;
  role: string; // family role: "admin" | "member"
  isPlatformAdmin: boolean; // built-in User.role === "admin" (app owner)
  channel: "web" | "whatsapp" | "unknown";
  // deno-lint-ignore no-explicit-any
  membership: any | null;
}

// Error carrying an HTTP status + a stable machine code the agent can translate
// into a natural-language message (not_linked / forbidden_role / billing_blocked).
export class AgentError extends Error {
  httpStatus: number;
  code: string;
  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = "AgentError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// ── Diagnostic helpers ────────────────────────────────────────────────────────

// Returns a header map with sensitive values redacted, for safe logging.
export function safeHeaders(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of req.headers) {
    const lk = k.toLowerCase();
    if (
      lk === "authorization" ||
      lk === "cookie" ||
      lk.includes("secret") ||
      lk.includes("token") ||
      lk.includes("apikey") ||
      lk.includes("api-key")
    ) {
      out[k] = "[redacted]";
    } else {
      out[k] = v.length > 200 ? v.slice(0, 200) + "…" : v;
    }
  }
  return out;
}

// ── Identity / tenant resolution ──────────────────────────────────────────────

// Resolves the caller's family + own person from trusted signals only.
// Logs a one-line diagnostic on every call so the WhatsApp identity mechanism can
// be confirmed from function logs without guessing (plan Fase 0.5).
export async function resolveAgentAccess(
  // deno-lint-ignore no-explicit-any
  base44: any,
  req: Request,
): Promise<AgentAccess> {
  // deno-lint-ignore no-explicit-any
  let user: any = null;
  try {
    user = await base44.auth.me();
  } catch {
    user = null;
  }

  // Read a clone for diagnostics so the original body stays readable by the tool.
  // body.family_id is logged for visibility but NEVER trusted.
  let bodyKeys: string[] = [];
  try {
    const body = await req.clone().json();
    bodyKeys = body && typeof body === "object" ? Object.keys(body) : [];
  } catch {
    bodyKeys = [];
  }

  console.log(
    "[agentGuard] diag " +
      JSON.stringify({
        authMe: user ? { id: user.id, email: user.email, role: user.role } : null,
        headers: safeHeaders(req),
        bodyKeys,
      }),
  );

  if (!user) {
    // WhatsApp / webhook origin: no authenticated user. The identity signal is in
    // the diagnostic above; precise, secure resolution is wired once confirmed.
    throw new AgentError(
      "not_linked",
      "Tu sesión no está vinculada. Abre FlowFin y toca el botón de WhatsApp para reconectarte.",
      401,
    );
  }

  const entities = base44.asServiceRole.entities;
  let memberships = await entities.FamilyMembership.filter({
    user_id: user.id,
    status: "approved",
  });
  if (!memberships?.length) {
    memberships = await entities.FamilyMembership.filter({
      user_email: user.email,
      status: "approved",
    });
  }
  if (!memberships?.length) {
    throw new AgentError(
      "not_linked",
      "Todavía no perteneces a ninguna familia en FlowFin.",
      401,
    );
  }

  // Pick the active family when the user belongs to several.
  let membership = memberships[0];
  if (memberships.length > 1) {
    const activeId = user.data?.family_id ?? user.data?.data?.family_id;
    membership = memberships.find(
      // deno-lint-ignore no-explicit-any
      (m: any) => m.family_id === activeId,
    ) ??
      [...memberships].sort(
        // deno-lint-ignore no-explicit-any
        (a: any, b: any) => (b.last_active_at ?? "").localeCompare(a.last_active_at ?? ""),
      )[0];
  }

  return {
    user,
    familyId: membership.family_id,
    selfPersonId: membership.person_id ?? null,
    role: membership.role ?? "member",
    isPlatformAdmin: user.role === "admin",
    channel: "web",
    membership,
  };
}

// ── Role enforcement (mirrors src/lib/permissions) ────────────────────────────

// Maps an assistant capability to the RolePermission boolean column.
// Mirrors src/lib/permissions/columns.js: create=can_write, modify=can_modify,
// delete=can_delete, view=can_read/can_view.
const CAP_FIELD: Record<Capability, string> = {
  view: "can_read",
  create: "can_write",
  modify: "can_modify",
  delete: "can_delete",
};

// Server copy of the client DEFAULT_MATRIX for the keys the assistant uses.
// KEEP IN SYNC with src/components/<module>/permissions.js `defaults`.
// Only verified keys are included; expand as tools for other modules are added.
type PermRow = Partial<Record<string, boolean>>;
const OPEN: PermRow = {
  can_read: true,
  can_write: true,
  can_modify: true,
  can_delete: true,
  can_view: true,
};
const CLOSED: PermRow = {
  can_read: false,
  can_write: false,
  can_modify: false,
  can_delete: false,
  can_view: false,
};

const DEFAULT_MATRIX: Record<string, Record<string, PermRow>> = {
  admin: {
    "transaction.view": OPEN,
    "transaction.create": OPEN,
    "transaction.edit": OPEN,
    "transaction.delete": OPEN,
  },
  member: {
    "transaction.view": { can_read: true, can_write: true, can_modify: true, can_delete: false, can_view: true },
    "transaction.create": { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    "transaction.edit": { can_read: true, can_write: false, can_modify: true, can_delete: false, can_view: true },
    "transaction.delete": { can_read: true, can_write: false, can_modify: false, can_delete: true, can_view: true },
  },
};

// Pure: effective permission for (role, key) = DB row → client default → role floor.
export function effectivePermission(
  role: string,
  permissionKey: string,
  dbRow: PermRow | null,
): PermRow {
  if (dbRow) return dbRow;
  const def = DEFAULT_MATRIX[role]?.[permissionKey];
  if (def) return def;
  return role === "admin" ? OPEN : CLOSED;
}

// Pure: whether a permission object grants the capability.
export function decideCapability(perm: PermRow | null | undefined, capability: Capability): boolean {
  if (!perm) return false;
  return perm[CAP_FIELD[capability]] === true;
}

// Enforces a role capability the same way the client does. Platform admin bypasses.
export async function requireRole(
  // deno-lint-ignore no-explicit-any
  base44: any,
  access: AgentAccess,
  permissionKey: string,
  capability: Capability,
): Promise<void> {
  if (access.isPlatformAdmin) return;
  const rows = await base44.asServiceRole.entities.RolePermission.filter({
    family_id: access.familyId,
    role: access.role,
    permission_key: permissionKey,
  });
  const dbRow: PermRow | null = rows?.[0] ?? null;
  const perm = effectivePermission(access.role, permissionKey, dbRow);
  if (!decideCapability(perm, capability)) {
    throw new AgentError(
      "forbidden_role",
      `No tienes permiso para esta acción (${permissionKey}).`,
      403,
    );
  }
}

// ── Billing gate (mirrors validateMutationAllowed) ────────────────────────────

export async function assertBillingAllowed(
  // deno-lint-ignore no-explicit-any
  base44: any,
  access: AgentAccess,
): Promise<void> {
  if (access.isPlatformAdmin) return;
  const fam = await base44.asServiceRole.entities.Family.get(access.familyId).catch(() => null);
  const status = fam?.billing_status ?? "active";
  if (status === "view_only" || status === "suspended") {
    throw new AgentError(
      "billing_blocked",
      "Tu suscripción está en modo solo lectura; no puedo registrar cambios ahora.",
      403,
    );
  }
}

// ── Allow-lists ───────────────────────────────────────────────────────────────

// Family-scoped entities the assistant may READ (the user's tenant universe).
export const READABLE_ENTITIES = new Set<string>([
  "Transaction",
  "ScheduledPayment",
  "ScheduledPaymentRecord",
  "MSI",
  "MSIPayment",
  "Investment",
  "InvestmentPayment",
  "RentalProperty",
  "RentalPayment",
  "Goal",
  "Trip",
  "Category",
  "Subcategory",
  "Person",
  "PaymentMethod",
  "CategoryBudget",
  "AnomalyAlert",
  "FamilyConfig",
  "CreditCardSnapshot",
  "PaymentEvent",
]);

// Fields the assistant may never set/overwrite on any entity.
export const IMMUTABLE_FIELDS = new Set<string>([
  "id",
  "family_id",
  "created_by",
  "created_by_id",
  "created_date",
  "updated_date",
  "is_sample",
]);

// Returns a filter that is always scoped to the caller's family.
export function scopeFilter(
  access: AgentAccess,
  filter: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...filter, family_id: access.familyId };
}

// Throws unless the referenced record exists and belongs to the caller's family.
export async function assertRefInFamily(
  // deno-lint-ignore no-explicit-any
  base44: any,
  access: AgentAccess,
  entityName: string,
  id: string,
  label = entityName,
): Promise<void> {
  try {
    const rec = await base44.asServiceRole.entities[entityName].get(id);
    if (!rec || rec.family_id !== access.familyId) {
      throw new AgentError("forbidden_ref", `${label} no pertenece a tu familia.`, 403);
    }
  } catch (e) {
    if (e instanceof AgentError) throw e;
    throw new AgentError("forbidden_ref", `${label} no existe o no pertenece a tu familia.`, 403);
  }
}

// Strips immutable + cross-tenant fields from an LLM-provided data object.
export function sanitizeWriteData(
  data: Record<string, unknown>,
  allowedFields: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    if (IMMUTABLE_FIELDS.has(k)) continue;
    if (!allowedFields.has(k)) continue;
    out[k] = v;
  }
  return out;
}

// ── Error → Response ──────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
export function agentErrorResponse(err: any): Response {
  const status: number = err?.httpStatus ?? 500;
  const code: string = err?.code ?? "internal";
  const message: string = status >= 500 ? "internal" : err?.message ?? "error";
  if (status >= 500) console.error("[agentGuard] error", err);
  return Response.json({ error: code, message }, { status });
}
