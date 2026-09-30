// Unit tests for _membershipRules.ts (one user = one family; approval picks a
// role from a closed list). No external imports: runs under
// `deno test base44/functions/` where deno.land/jsr.io are blocked.

import {
  canApprove,
  canDecideOn,
  decideCreate,
  decideJoin,
  dedupeMemberships,
  normalizeAssignableRole,
} from "./_membershipRules.ts";

function eq(actual: unknown, expected: unknown, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg} expected ${e}, got ${a}`);
}

Deno.test("role whitelist: member/admin only, default member, never platform roles", () => {
  eq(normalizeAssignableRole(undefined), "member");
  eq(normalizeAssignableRole(""), "member");
  eq(normalizeAssignableRole("member"), "member");
  eq(normalizeAssignableRole(" Admin "), "admin");
  for (const bad of ["owner", "superadmin", "platform", "user", "business_admin", 1, {}, ["admin"]]) {
    eq(normalizeAssignableRole(bad), null, `role ${JSON.stringify(bad)}`);
  }
});

Deno.test("decideJoin: new user proceeds", () => {
  eq(decideJoin([], "F1"), { kind: "proceed" });
  eq(decideJoin([{ family_id: "F9", status: "rejected" }], "F1"), { kind: "proceed" });
});

Deno.test("decideJoin: approved elsewhere is a 409, approved here is already_member", () => {
  const d = decideJoin([{ family_id: "F2", status: "approved" }], "F1");
  eq(d.kind, "conflict");
  eq((d as { code: string }).code, "already_in_family");
  eq(decideJoin([{ family_id: "F1", status: "approved" }], "F1"), { kind: "already_member" });
});

Deno.test("decideJoin: users with several approved memberships are not expelled", () => {
  const two = [
    { family_id: "F1", status: "approved" },
    { family_id: "F2", status: "approved" },
  ];
  eq(decideJoin(two, "F1"), { kind: "already_member" });
  eq(decideJoin(two, "F2"), { kind: "already_member" });
  eq(decideJoin(two, "F3").kind, "conflict");
});

Deno.test("decideJoin: pending same family is idempotent, pending elsewhere asks to cancel", () => {
  eq(decideJoin([{ family_id: "F1", status: "pending" }], "F1"), { kind: "already_pending" });
  const d = decideJoin([{ family_id: "F2", status: "pending" }], "F1");
  eq(d.kind, "conflict");
  eq((d as { code: string }).code, "pending_elsewhere");
});

Deno.test("decideCreate: approved or pending blocks", () => {
  eq(decideCreate([]), { kind: "proceed" });
  eq(decideCreate([{ status: "rejected" }]), { kind: "proceed" });
  eq(decideCreate([{ status: "approved" }]).kind, "conflict");
  eq(decideCreate([{ status: "pending" }]).kind, "conflict");
});

Deno.test("canDecideOn: only a stored pending row of the same family", () => {
  eq(canDecideOn({ family_id: "F1", status: "pending" }, "F1"), { ok: true });
  eq(canDecideOn(undefined, "F1").ok, false);
  const foreign = canDecideOn({ family_id: "F2", status: "pending" }, "F1");
  eq(foreign.ok, false);
  eq((foreign as { status: number }).status, 403);
  const done = canDecideOn({ family_id: "F1", status: "approved" }, "F1");
  eq((done as { status: number }).status, 409);
  eq(canDecideOn({ family_id: "F1", status: "rejected" }, "F1").ok, false);
});

Deno.test("dedupeMemberships merges rows found by user_id and by e-mail", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "a" }];
  eq(dedupeMemberships(rows).length, 2);
});

Deno.test("canApprove: pending proceeds; an approved row of the same family completes the retry", () => {
  eq(canApprove({ family_id: "F1", status: "pending" }, "F1"), { ok: true, alreadyApproved: false });
  eq(canApprove({ family_id: "F1", status: "approved" }, "F1"), { ok: true, alreadyApproved: true });
});

Deno.test("canApprove: still refuses foreign, missing, rejected and cancelled rows", () => {
  eq(canApprove(undefined, "F1").ok, false);
  const foreign = canApprove({ family_id: "F2", status: "approved" }, "F1");
  eq(foreign.ok, false);
  eq((foreign as { status: number }).status, 403);
  eq((canApprove({ family_id: "F1", status: "rejected" }, "F1") as { status: number }).status, 409);
  eq(canApprove({ family_id: "F1", status: "cancelled" }, "F1").ok, false);
});

Deno.test("canDecideOn (used by reject) still refuses an approved row", () => {
  eq((canDecideOn({ family_id: "F1", status: "approved" }, "F1") as { status: number }).status, 409);
});

Deno.test('wouldLeaveNoAdmin: last admin blocked, second admin or member allowed', async () => {
  const { wouldLeaveNoAdmin } = await import('./_membershipRules.ts');
  const a = { id: 'a', status: 'approved', role: 'admin' };
  const b = { id: 'b', status: 'approved', role: 'admin' };
  const m = { id: 'm', status: 'approved', role: 'member' };
  const p = { id: 'p', status: 'pending', role: 'admin' };
  if (!wouldLeaveNoAdmin(a, [a, m])) throw new Error('last admin must be blocked');
  if (!wouldLeaveNoAdmin(a, [a, p])) throw new Error('pending admin does not count');
  if (wouldLeaveNoAdmin(a, [a, b])) throw new Error('second admin allows removal');
  if (wouldLeaveNoAdmin(m, [a, m])) throw new Error('member removal is fine');
  if (wouldLeaveNoAdmin(null, [a])) throw new Error('missing row is fine');
});
