// guardedEntityWrite — server-authoritative write gate for the 15
// family-scoped entities the web UI writes directly (Transaction, Category,
// Subcategory, Person, PaymentMethod, CategoryBudget, Goal, Investment,
// InvestmentPayment, MSI, MSIPayment, RentalProperty, RentalPayment,
// ScheduledPayment, ScheduledPaymentRecord, Trip).
//
// WHY THIS EXISTS (module 3 of the portfolio standard — see CLAUDE.md's
// "Read-only billing gate" section, which documents this as the tracked
// follow-up to the 2026-08-18 AI-assistant billing-gate fix)
// `validateMutationAllowed`/`_agentGuard.ts`'s `assertBillingAllowed` block
// writes once a family's billing_status is view_only/suspended, and
// `usePermission()` gates the UI by RolePermission + DEFAULT_MATRIX — but
// neither was ever enforced server-side for the ~80 direct
// `base44.entities.X.create/update/delete(...)` call sites across src/hooks,
// src/pages, and src/components. A user whose RolePermission an admin had
// explicitly restricted, or a family in a read-only billing state, could
// still write via a direct SDK call — the exact same shape of gap the
// AI-assistant tools had before that fix, just on the human UI's own writes
// instead of Finia's.
//
// This function is now the sanctioned write path for those 15 entities. It
// re-derives the caller's family + role from their own approved
// FamilyMembership (never from the request), then checks: billing read-only
// status (mirrors assertBillingAllowed) -> the entity's RolePermission +
// DEFAULT_MATRIX permission key, where one is defined (mirrors
// usePermission()'s own three-layer resolution — see logic.ts for the exact
// mirrored tables and why CategoryBudget has no key to check). Platform
// owner (user.role === 'admin') bypasses both, same as every other
// privileged path in this app.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import {
  decideCapability,
  effectivePermission,
  GUARDED_ENTITIES,
  isBillingReadOnly,
  type Operation,
  permissionKeyFor,
} from "./logic.ts";

const OPERATIONS: Operation[] = ["create", "update", "delete"];

function bad(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, code, error: message }, { status });
}

// deno-lint-ignore no-explicit-any
async function resolveFamilyAccess(base44: any, user: any) {
  const entities = base44.asServiceRole.entities;
  let memberships = await entities.FamilyMembership.filter({ user_id: user.id, status: "approved" });
  if (!memberships?.length) {
    memberships = await entities.FamilyMembership.filter({ user_email: user.email, status: "approved" });
  }
  if (!memberships?.length) return null;

  let membership = memberships[0];
  if (memberships.length > 1) {
    const activeId = user.data?.family_id ?? user.data?.data?.family_id;
    // deno-lint-ignore no-explicit-any
    membership = memberships.find((m: any) => m.family_id === activeId) ??
      // deno-lint-ignore no-explicit-any
      [...memberships].sort((a: any, b: any) => (b.last_active_at ?? "").localeCompare(a.last_active_at ?? ""))[0];
  }

  return { familyId: membership.family_id as string, role: (membership.role ?? "member") as string };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return bad(401, "UNAUTHENTICATED", "Unauthorized");

    const body = await req.json().catch(() => ({}));
    const entity = String(body?.entity || "");
    const operation = String(body?.operation || "") as Operation;
    if (!GUARDED_ENTITIES.includes(entity)) return bad(400, "UNKNOWN_ENTITY", "Unsupported entity");
    if (!OPERATIONS.includes(operation)) return bad(400, "BAD_OPERATION", "operation must be create/update/delete");

    const sr = base44.asServiceRole;
    const isPlatformOwner = user.role === "admin";

    // Resolved once, reused by both the tenant check below and the
    // permission-key check further down.
    const access = isPlatformOwner ? null : await resolveFamilyAccess(base44, user);
    if (!isPlatformOwner && !access) return bad(403, "NOT_LINKED", "You don't belong to a family yet");

    let familyId: string;
    let existing: Record<string, unknown> | null = null;
    if (operation === "create") {
      // family_id is NEVER trusted from the client — it's always the
      // caller's own resolved family (platform owner must supply one
      // explicitly, since they have no family membership of their own).
      if (isPlatformOwner) {
        familyId = String(body?.data?.family_id || "");
        if (!familyId) return bad(400, "MISSING_FAMILY", "data.family_id is required");
      } else {
        familyId = access!.familyId;
      }
    } else {
      const id = String(body?.id || "");
      if (!id) return bad(400, "MISSING_ID", "id is required");
      existing = await sr.entities[entity].get(id).catch(() => null);
      if (!existing) return bad(404, "NOT_FOUND", "Record not found");
      familyId = String((existing as { family_id?: string }).family_id || "");
      if (!isPlatformOwner && access!.familyId !== familyId) {
        return bad(403, "CROSS_TENANT", "Record belongs to another family");
      }
    }

    if (!isPlatformOwner) {
      // Permission-key check (skipped for entities with no defined key, e.g.
      // CategoryBudget — see logic.ts).
      const permissionKey = permissionKeyFor(entity, operation);
      if (permissionKey) {
        const rows = await sr.entities.RolePermission.filter({
          family_id: familyId,
          role: access!.role,
          permission_key: permissionKey,
        });
        const perm = effectivePermission(access!.role, permissionKey, rows?.[0] ?? null);
        if (!decideCapability(perm, operation)) {
          return bad(403, "FORBIDDEN", "Not permitted to write this resource");
        }
      }

      // Billing write-gate.
      const fam = await sr.entities.Family.get(familyId).catch(() => null);
      if (isBillingReadOnly((fam as { billing_status?: string } | null)?.billing_status)) {
        return bad(403, "WRITE_BLOCKED", "This family's subscription is read-only");
      }
    }

    if (operation === "create") {
      const data = { ...(body.data || {}), family_id: familyId };
      const created = await sr.entities[entity].create(data);
      return Response.json({ ok: true, record: created });
    }

    if (operation === "update") {
      const patch = { ...(body.data || {}) };
      delete (patch as { family_id?: unknown }).family_id;
      const updated = await sr.entities[entity].update(String((existing as { id: string }).id), patch);
      return Response.json({ ok: true, record: updated });
    }

    await sr.entities[entity].delete(String((existing as { id: string }).id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, code: "INTERNAL", error: (e as Error).message }, { status: 500 });
  }
});
