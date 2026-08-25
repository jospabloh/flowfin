// Pure decision logic for switchFamily — no imports, no I/O, so it can be
// unit-tested directly (see switchFamilyLogic.test.ts) without starting a
// server. Same split, and same reason, as guardedEntityWrite/logic.ts:
// entry-point code (switchFamily.ts) that does real I/O imports this file —
// an intra-function-directory import is fine, Base44 bundles a whole
// function directory together; it's only imports ACROSS separate top-level
// function directories that don't work.

export interface MembershipRow {
  family_id: string;
  status: string;
}

export interface SwitchDecision {
  allowed: boolean;
  reason?: "invalid_family_id" | "not_a_member";
}

// Decides whether `requestedFamilyId` is a family the caller may switch to,
// given their actual approved memberships (fetched server-side via
// asServiceRole by the caller of this function — never trust a client-sent
// membership list). Denies identically whether the id belongs to someone
// else's family or doesn't exist at all — no existence oracle
// (acacia-app-standard STANDARD.md §18, point 2).
export function decideSwitchFamily(
  memberships: MembershipRow[],
  requestedFamilyId: string,
): SwitchDecision {
  if (!requestedFamilyId || typeof requestedFamilyId !== "string") {
    return { allowed: false, reason: "invalid_family_id" };
  }
  const isApprovedMember = memberships.some(
    (m) => m.status === "approved" && m.family_id === requestedFamilyId,
  );
  if (!isApprovedMember) {
    return { allowed: false, reason: "not_a_member" };
  }
  return { allowed: true };
}
