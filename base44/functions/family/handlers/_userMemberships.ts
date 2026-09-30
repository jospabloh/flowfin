import { dedupeMemberships, type MembershipLike } from './_membershipRules.ts';

// Every membership row of a user (any status), found by user_id AND by
// e-mail, via service role. `sr` is `base44.asServiceRole`.
// deno-lint-ignore no-explicit-any
export async function loadUserMemberships(sr: any, user: { id: string; email?: string }): Promise<MembershipLike[]> {
  const byId = await sr.entities.FamilyMembership.filter({ user_id: user.id });
  const email = (user.email || '').trim().toLowerCase();
  const byEmail = email ? await sr.entities.FamilyMembership.filter({ user_email: email }) : [];
  return dedupeMemberships([...(byId || []), ...(byEmail || [])]);
}

// Caller may act on `familyId` if they are the platform owner or an APPROVED
// admin of that family. Re-read from the stored membership, never trusted
// from the request.
// deno-lint-ignore no-explicit-any
export async function isFamilyAdmin(sr: any, user: { id: string; role?: string }, familyId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  const rows = await sr.entities.FamilyMembership.filter({
    family_id: familyId,
    user_id: user.id,
    role: 'admin',
    status: 'approved',
  });
  return !!rows?.length;
}
