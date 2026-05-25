// Unit tests for the pure decision logic of _agentGuard.ts.
// These run under `deno test base44/functions/` with no platform/DB access and
// guard against the subtle failures: wrong permission key/boolean mapping,
// missing family_id injection, and unsanitized writes.

import {
  type Capability,
  decideCapability,
  effectivePermission,
  IMMUTABLE_FIELDS,
  sanitizeWriteData,
  scopeFilter,
} from "./_agentGuard.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("assertion failed: " + msg);
}
function assertEquals(actual: unknown, expected: unknown, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`assertEquals failed (${msg}): ${a} !== ${e}`);
}

// deno-lint-ignore no-explicit-any
const access = (familyId: string): any => ({ familyId });

Deno.test("effectivePermission: member uses client defaults when no DB row", () => {
  assertEquals(
    effectivePermission("member", "transaction.create", null).can_write,
    true,
    "member can create by default",
  );
  assertEquals(
    effectivePermission("member", "transaction.create", null).can_delete,
    false,
    "member cannot delete via create key",
  );
  assertEquals(
    effectivePermission("member", "transaction.delete", null).can_delete,
    true,
    "member can delete via delete key",
  );
  assertEquals(
    effectivePermission("member", "transaction.edit", null).can_modify,
    true,
    "member can modify via edit key",
  );
});

Deno.test("effectivePermission: DB row overrides the default", () => {
  const row = { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true };
  assertEquals(
    effectivePermission("member", "transaction.create", row).can_write,
    false,
    "DB row wins over default",
  );
});

Deno.test("effectivePermission: unknown key falls back to role floor", () => {
  assertEquals(effectivePermission("member", "unknown.key", null), {
    can_read: false,
    can_write: false,
    can_modify: false,
    can_delete: false,
    can_view: false,
  }, "member floor is CLOSED");
  assertEquals(effectivePermission("admin", "unknown.key", null), {
    can_read: true,
    can_write: true,
    can_modify: true,
    can_delete: true,
    can_view: true,
  }, "admin floor is OPEN");
});

Deno.test("decideCapability: maps each capability to the right column", () => {
  const perm = { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true };
  const cases: Array<[Capability, boolean]> = [
    ["view", true],
    ["create", true],
    ["modify", false],
    ["delete", false],
  ];
  for (const [cap, expected] of cases) {
    assertEquals(decideCapability(perm, cap), expected, `capability ${cap}`);
  }
  assert(!decideCapability(null, "view"), "null perm denies");
});

Deno.test("scopeFilter: always forces the caller's family_id", () => {
  assertEquals(
    scopeFilter(access("FAM_A"), { type: "expense" }),
    { type: "expense", family_id: "FAM_A" },
    "adds family_id",
  );
  assertEquals(
    scopeFilter(access("FAM_A"), { family_id: "FAM_B" }).family_id,
    "FAM_A",
    "overrides a spoofed family_id",
  );
  assertEquals(scopeFilter(access("FAM_A")).family_id, "FAM_A", "works with no base filter");
});

Deno.test("sanitizeWriteData: strips immutable and disallowed fields", () => {
  const allowed = new Set(["amount", "description", "category_id"]);
  const out = sanitizeWriteData(
    {
      amount: 100,
      description: "x",
      category_id: "C1",
      family_id: "EVIL",
      id: "spoof",
      created_by: "evil@x.com",
      person_role: "admin", // not in allow-list
    },
    allowed,
  );
  assertEquals(out, { amount: 100, description: "x", category_id: "C1" }, "only allowed fields survive");
  assert(!("family_id" in out), "family_id stripped");
  assert(!("id" in out), "id stripped");
  assert(IMMUTABLE_FIELDS.has("family_id"), "family_id is immutable");
});
