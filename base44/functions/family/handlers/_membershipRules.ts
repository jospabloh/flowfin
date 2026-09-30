// Pure rules for who may join / be approved into a family. No imports, so
// `deno test` loads it without the SDK (which is blocked in the sandbox).
//
// Contract (2026-09-30): a user belongs to ONE family. Joining by code only
// files a `pending` request; a family admin approves it and CHOOSES the role,
// from this closed list. The platform role (`User.role: 'admin'`) is never
// assignable here: it lives on User, not on FamilyMembership.

export const ASSIGNABLE_ROLES = ['member', 'admin'] as const;
export type AssignableRole = typeof ASSIGNABLE_ROLES[number];

export interface MembershipLike {
  id?: string;
  family_id?: string;
  user_id?: string;
  user_email?: string;
  role?: string;
  status?: string;
}

// Returns the role to store, or null when the value is not assignable.
// Omitted/empty means the least-privileged default.
export function normalizeAssignableRole(role: unknown): AssignableRole | null {
  if (role === undefined || role === null || role === '') return 'member';
  if (typeof role !== 'string') return null;
  const r = role.trim().toLowerCase();
  return (ASSIGNABLE_ROLES as readonly string[]).includes(r) ? (r as AssignableRole) : null;
}

// Merge the rows found by user_id and by e-mail (same person, maybe both hit).
export function dedupeMemberships(rows: MembershipLike[]): MembershipLike[] {
  const seen = new Set<string>();
  const out: MembershipLike[] = [];
  for (const m of rows) {
    const key = m.id ?? `${m.family_id}|${m.user_email}|${m.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export type JoinDecision =
  | { kind: 'proceed' }
  | { kind: 'already_member' }
  | { kind: 'already_pending' }
  | { kind: 'conflict'; code: 'already_in_family' | 'pending_elsewhere'; message: string };

// What should selfJoin do for a user asking to join `targetFamilyId`?
// Existing users with several approved memberships are never expelled: if one
// of them IS the target family they are simply "already a member".
export function decideJoin(existing: MembershipLike[], targetFamilyId: string): JoinDecision {
  const approved = existing.filter((m) => m.status === 'approved');
  if (approved.some((m) => m.family_id === targetFamilyId)) return { kind: 'already_member' };
  if (approved.length) {
    return {
      kind: 'conflict',
      code: 'already_in_family',
      message: 'Ya perteneces a una familia. Cada cuenta pertenece a una sola familia.',
    };
  }
  const pending = existing.filter((m) => m.status === 'pending');
  if (pending.some((m) => m.family_id === targetFamilyId)) return { kind: 'already_pending' };
  if (pending.length) {
    return {
      kind: 'conflict',
      code: 'pending_elsewhere',
      message: 'Ya tienes una solicitud pendiente en otra familia. Cancélala antes de pedir acceso a esta.',
    };
  }
  return { kind: 'proceed' };
}

// Same rule for creating a family: any approved or pending membership blocks.
export function decideCreate(existing: MembershipLike[]): JoinDecision {
  if (existing.some((m) => m.status === 'approved')) {
    return {
      kind: 'conflict',
      code: 'already_in_family',
      message: 'Ya perteneces a una familia. Cada cuenta pertenece a una sola familia.',
    };
  }
  if (existing.some((m) => m.status === 'pending')) {
    return {
      kind: 'conflict',
      code: 'pending_elsewhere',
      message: 'Tienes una solicitud pendiente para unirte a una familia. Cancélala antes de crear una nueva.',
    };
  }
  return { kind: 'proceed' };
}

// Can `membership` be approved by an admin of `familyId`? Only a stored,
// pending row of that same family.
export function canDecideOn(
  membership: MembershipLike | undefined | null,
  familyId: string,
): { ok: true } | { ok: false; status: number; error: string } {
  if (!membership || membership.family_id !== familyId) {
    return { ok: false, status: 403, error: 'Forbidden: membership does not belong to this family' };
  }
  if (membership.status !== 'pending') {
    return { ok: false, status: 409, error: 'La solicitud ya fue resuelta.' };
  }
  return { ok: true };
}

// Approve-specific variant of canDecideOn. An approve that wrote the membership
// but failed before writing User.data.family_id leaves an `approved` row and a
// person with no pointer; the admin's retry must be able to finish that
// reconciliation instead of hitting 409 forever. So a row of the same family that
// is already `approved` is allowed through, flagged `alreadyApproved`, and the
// handler then only (re)writes the pointer: no role change, no limit check (the
// row already counts). `rejected`/`cancelled` rows are still refused. Reject keeps
// using canDecideOn (an approved row must never be rejected by a retry).
export function canApprove(
  membership: MembershipLike | undefined | null,
  familyId: string,
): { ok: true; alreadyApproved: boolean } | { ok: false; status: number; error: string } {
  if (membership && membership.family_id === familyId && membership.status === 'approved') {
    return { ok: true, alreadyApproved: true };
  }
  const d = canDecideOn(membership, familyId);
  return d.ok ? { ok: true, alreadyApproved: false } : d;
}
