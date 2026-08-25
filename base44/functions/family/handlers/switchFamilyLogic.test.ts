// Unit tests for switchFamily's pure decision logic. Runs under
// `deno test base44/functions/` with no platform/DB access — same style as
// guardedEntityWrite/logic.test.ts and _agentGuard.test.ts.

import { decideSwitchFamily } from "./switchFamilyLogic.ts";

function assertEquals(actual: unknown, expected: unknown, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`assertEquals failed (${msg}): ${a} !== ${e}`);
}

Deno.test("decideSwitchFamily: allows switching to a family the caller has an approved membership in", () => {
  const memberships = [
    { family_id: "fam_a", status: "approved" },
    { family_id: "fam_b", status: "approved" },
  ];
  assertEquals(decideSwitchFamily(memberships, "fam_b"), { allowed: true });
});

Deno.test("decideSwitchFamily: denies a family_id not among the caller's memberships at all", () => {
  const memberships = [{ family_id: "fam_a", status: "approved" }];
  assertEquals(decideSwitchFamily(memberships, "fam_other"), { allowed: false, reason: "not_a_member" });
});

Deno.test("decideSwitchFamily: denies a pending (not yet approved) membership identically to no membership", () => {
  const memberships = [{ family_id: "fam_a", status: "pending" }];
  assertEquals(decideSwitchFamily(memberships, "fam_a"), { allowed: false, reason: "not_a_member" });
  assertEquals(decideSwitchFamily([], "fam_a"), { allowed: false, reason: "not_a_member" });
});

Deno.test("decideSwitchFamily: denies a missing, empty, or non-string family_id", () => {
  const memberships = [{ family_id: "fam_a", status: "approved" }];
  assertEquals(decideSwitchFamily(memberships, ""), { allowed: false, reason: "invalid_family_id" });
  // deno-lint-ignore no-explicit-any
  assertEquals(decideSwitchFamily(memberships, null as any), { allowed: false, reason: "invalid_family_id" });
});

Deno.test("decideSwitchFamily: a rejected membership does not grant access", () => {
  const memberships = [{ family_id: "fam_a", status: "rejected" }];
  assertEquals(decideSwitchFamily(memberships, "fam_a"), { allowed: false, reason: "not_a_member" });
});
