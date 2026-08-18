// Pure decision logic for guardedEntityWrite — deliberately has NO Deno.serve,
// no imports, and no I/O, so it can be unit-tested directly (see logic.test.ts)
// without starting a server, same reason _agentGuard.ts's pure exports are
// split from any entry.ts. entry.ts in this same directory imports this file
// (an intra-function-directory import is fine — Base44 bundles a whole
// function directory together; it's only imports ACROSS separate top-level
// function directories that don't work, see every other function's "no local
// imports in Deno deploy" comments in this repo).
//
// KEEP THIS IN SYNC BY HAND with the two things it mirrors:
//   - src/lib/permissions/aggregator.js's DEFAULT_MATRIX (built from every
//     src/**/permissions.js manifest) — specifically the *_MEMBER_DEFAULTS
//     below, one entry per permission key this function checks. Admin's
//     default is uniformly OPEN for every one of these keys in every
//     manifest (verified by reading each one), so there is no per-key admin
//     table to keep in sync — only ENTITY_PERMISSION_KEYS' key STRINGS need
//     to match the manifests if a module's permission keys are ever renamed.
//   - src/lib/license/... 's read-only billing statuses (view_only/suspended
//     — same two statuses _agentGuard.ts's assertBillingAllowed already
//     uses; FlowFin, unlike LIUMA, has no additional inactive/canceled
//     status in active use for Family.billing_status).

export type Operation = "create" | "update" | "delete";

export interface PermRow {
  can_read: boolean;
  can_write: boolean;
  can_modify: boolean;
  can_delete: boolean;
  can_view: boolean;
}

const OPEN: PermRow = { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true };
const CLOSED: PermRow = { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false };

// Maps an operation to the RolePermission boolean column it's gated by.
// Mirrors _agentGuard.ts's CAP_FIELD (create=can_write, modify=can_modify,
// delete=can_delete).
const CAP_FIELD: Record<Operation, keyof PermRow> = {
  create: "can_write",
  update: "can_modify",
  delete: "can_delete",
};

// The 15 family-scoped entities this function guards, and the permission key
// (from src/lib/permissions/*.permissions.js) that governs each operation on
// them. A single string applies to all three operations (create=can_write,
// update=can_modify, delete=can_delete on that one key); a per-operation map
// is used where the manifest defines separate keys per action. `null` means
// the entity's own permissions manifest defines no create/edit/delete key at
// all (only CategoryBudget today — budget.permissions.js has just a `view`
// section) — those entities get the family-membership + billing gate below
// but no permission-key check, which matches current behavior exactly (any
// family member can already write CategoryBudget; this function does not
// newly restrict that, only closes the billing/tenant gap for it).
export const ENTITY_PERMISSION_KEYS: Record<string, string | Partial<Record<Operation, string>> | null> = {
  Transaction: { create: "transaction.create", update: "transaction.edit", delete: "transaction.delete" },
  Category: "catalog.categories",
  Subcategory: "catalog.subcategories",
  Person: "catalog.persons",
  PaymentMethod: "catalog.methods",
  CategoryBudget: null,
  Goal: "goals.manage",
  Investment: "investment.crud",
  InvestmentPayment: "investment.payments",
  MSI: "msi.crud",
  MSIPayment: "msi.payments",
  RentalProperty: "rental.property",
  RentalPayment: "rental.payments",
  ScheduledPayment: { create: "scheduled.create", update: "scheduled.manage", delete: "scheduled.manage" },
  ScheduledPaymentRecord: { create: "scheduled.mark" },
  Trip: "trips.manage",
};

export const GUARDED_ENTITIES = Object.keys(ENTITY_PERMISSION_KEYS);

export function permissionKeyFor(entity: string, operation: Operation): string | null {
  const cfg = ENTITY_PERMISSION_KEYS[entity];
  if (cfg == null) return null;
  if (typeof cfg === "string") return cfg;
  return cfg[operation] ?? null;
}

// One row per permission key this function checks, for the "member" family
// role — sourced directly from each key's `defaults.member` entry in its
// src/**/permissions.js manifest (the single source of truth
// src/lib/permissions/aggregator.js's DEFAULT_MATRIX is built from).
const MEMBER_DEFAULTS: Record<string, PermRow> = {
  "transaction.create": { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
  "transaction.edit": { can_read: true, can_write: false, can_modify: true, can_delete: false, can_view: true },
  "transaction.delete": { can_read: true, can_write: false, can_modify: false, can_delete: true, can_view: true },
  "catalog.categories": { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
  "catalog.subcategories": { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
  "catalog.persons": { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
  "catalog.methods": { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
  "goals.manage": CLOSED,
  "investment.crud": CLOSED,
  "investment.payments": CLOSED,
  "msi.crud": CLOSED,
  "msi.payments": CLOSED,
  "rental.property": CLOSED,
  "rental.payments": CLOSED,
  "scheduled.create": { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
  "scheduled.manage": { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
  "scheduled.mark": { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
  "trips.manage": CLOSED,
};

// Pure: default permission for (family role, key) when no RolePermission DB
// row exists. Admin's default is OPEN for every key above (verified against
// every manifest); any other role falls back to CLOSED (deny-by-default),
// matching aggregator.js's own getDefaultPermission fallback.
export function defaultPermission(role: string, permissionKey: string): PermRow {
  if (role === "admin") return OPEN;
  return MEMBER_DEFAULTS[permissionKey] ?? CLOSED;
}

// Pure: effective permission = DB row (if any) else the role default. Mirrors
// usePermission.js's own three-layer resolution (platform-admin bypass is
// handled by the caller before this, same split _agentGuard.ts uses).
export function effectivePermission(role: string, permissionKey: string, dbRow: Partial<PermRow> | null): PermRow {
  if (dbRow) {
    return {
      can_read: dbRow.can_read ?? false,
      can_write: dbRow.can_write ?? false,
      can_modify: dbRow.can_modify ?? false,
      can_delete: dbRow.can_delete ?? false,
      can_view: dbRow.can_view ?? false,
    };
  }
  return defaultPermission(role, permissionKey);
}

export function decideCapability(perm: PermRow, operation: Operation): boolean {
  return perm[CAP_FIELD[operation]] === true;
}

// Same two statuses _agentGuard.ts's assertBillingAllowed already blocks on.
const READ_ONLY_BILLING_STATUSES = new Set(["view_only", "suspended"]);

export function isBillingReadOnly(billingStatus: string | null | undefined): boolean {
  return READ_ONLY_BILLING_STATUSES.has(String(billingStatus ?? "active"));
}
