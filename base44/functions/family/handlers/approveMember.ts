import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { canApprove, normalizeAssignableRole } from './_membershipRules.ts';
import { isFamilyAdmin, loadUserMemberships } from './_userMemberships.ts';

// Approve a pending join request and give the person a role.
//
// Trust model: nothing about WHO is being approved comes from the request.
// The membership is re-read from storage, must belong to the caller's family
// and still be `pending`; the person is `membership.user_id`, never a
// client-sent id. `role` comes from the client but only from a closed list
// (member | admin); the platform role is not on that list.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { membership_id, family_id, role } = await req.json();

    if (!membership_id || !family_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const chosenRole = normalizeAssignableRole(role);
    if (!chosenRole) {
      return Response.json({ error: 'Rol no permitido' }, { status: 400 });
    }

    const sr = base44.asServiceRole;

    // Verify caller is app admin OR an approved admin of THIS family
    if (!(await isFamilyAdmin(sr, user, family_id))) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Stored membership: must belong to the claimed family and be pending
    const memberships = await sr.entities.FamilyMembership.filter({ id: membership_id });
    const targetMembership = memberships?.[0];
    // canApprove also lets an already-approved row of this family through, so a
    // retry after a half-finished approve can complete the pointer write below.
    // Two admins approving the same request at once is not guarded (no unique
    // constraint / transaction in Base44): both writes are idempotent and end in
    // the same state, the second just re-writes the same pointer.
    const decision = canApprove(targetMembership, family_id);
    if (!decision.ok) {
      return Response.json({ error: decision.error }, { status: decision.status });
    }

    // One user = one family: refuse if the person is already approved in a
    // different family (they must leave it first).
    const targetUserId = targetMembership.user_id;
    const theirs = await loadUserMemberships(sr, { id: targetUserId, email: targetMembership.user_email });
    if (theirs.some((m) => m.status === 'approved' && m.family_id !== family_id)) {
      return Response.json({
        error: 'Esta persona ya pertenece a otra familia. Debe salir de ella antes de unirse.',
        code: 'already_in_family',
      }, { status: 409 });
    }

    // Fetch family to check member limit
    const familyRecords = await sr.entities.Family.filter({ id: family_id });
    const currentFamily = familyRecords?.[0];
    if (currentFamily && !decision.alreadyApproved) {
      const approvedMembers = await sr.entities.FamilyMembership.filter({
        family_id,
        status: 'approved',
      });
      const memberLimit = currentFamily.licensed_member_limit || 4;
      if (approvedMembers.length >= memberLimit) {
        return Response.json({
          error: `Límite de integrantes alcanzado (${memberLimit}). Actualiza tu plan para agregar más miembros.`,
          limit_reached: true,
          current_count: approvedMembers.length,
          limit: memberLimit,
        }, { status: 403 });
      }
    }

    // On a retry (already approved) keep the stored role: the retry only
    // reconciles the User pointer, it must not silently change what the first
    // approve granted.
    if (!decision.alreadyApproved) {
      await sr.entities.FamilyMembership.update(membership_id, { status: 'approved', role: chosenRole });
    }

    // Point the person's User at this family. Flat data payload built from the
    // STORED user (never the caller's view), same pattern as createFamily.
    if (targetUserId) {
      const users = await sr.entities.User.filter({ id: targetUserId });
      if (users?.[0]) {
        const userData = { ...(users[0].data || {}), family_id };
        delete userData.data;
        await sr.entities.User.update(targetUserId, { data: userData });
      }
    }

    return Response.json({
      success: true,
      role: decision.alreadyApproved ? (targetMembership.role ?? chosenRole) : chosenRole,
      ...(decision.alreadyApproved ? { reconciled: true } : {}),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
