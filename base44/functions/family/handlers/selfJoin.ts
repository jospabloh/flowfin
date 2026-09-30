import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { decideJoin } from './_membershipRules.ts';
import { loadUserMemberships } from './_userMemberships.ts';

// Joining by code NEVER grants access: it files a `pending` request that a
// family admin must approve (approveMember, which also chooses the role).
// One user = one family: 409 if the caller already belongs to (or is waiting
// on) a different one. The only place this writes User.family_id is the
// idempotent "you are already an approved member of THIS family" repair.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { join_code, user_email, user_name, ref } = await req.json();

    if (!join_code || !user_email) {
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Sanitize referrer: must be a non-empty string distinct from the joiner.
    // Stored as-is for analytics; downstream reward logic does its own
    // existence checks before granting referral credit.
    const invitedByUserId = typeof ref === 'string' && ref.trim() && ref.trim() !== user.id
      ? ref.trim()
      : undefined;

    // Only allow the authenticated user to join with their own email
    if (user.email.toLowerCase() !== user_email.trim().toLowerCase()) {
      return Response.json({ error: 'Email no coincide con el usuario autenticado' }, { status: 403 });
    }

    // Search family by code using service role
    const families = await base44.asServiceRole.entities.Family.filter({ join_code: join_code.trim().toUpperCase() });
    if (!families.length) {
      return Response.json({ found: false, error: 'Código no encontrado' });
    }
    const family = families[0];

    const existing = await loadUserMemberships(base44.asServiceRole, user);
    const decision = decideJoin(existing, family.id);

    if (decision.kind === 'conflict') {
      return Response.json({ error: decision.message, code: decision.code }, { status: 409 });
    }

    if (decision.kind === 'already_member') {
      // Repair the persisted pointer from the STORED user, then answer. Does
      // not touch the membership: approval already happened.
      const users = await base44.asServiceRole.entities.User.filter({ id: user.id });
      const userData = { ...(users?.[0]?.data || user.data || {}), family_id: family.id };
      delete userData.data;
      await base44.asServiceRole.entities.User.update(user.id, { data: userData });
      return Response.json({ success: true, already_member: true });
    }

    if (decision.kind === 'already_pending') {
      return Response.json({ success: true, pending: true });
    }

    // Block if family is suspended
    if (family.billing_status === 'suspended') {
      return Response.json({ error: 'Esta familia está suspendida. Contacta al administrador.' }, { status: 403 });
    }

    // Create pending membership (requires admin approval). Role and status
    // are fixed here: the requester chooses neither.
    await base44.asServiceRole.entities.FamilyMembership.create({
      family_id: family.id,
      user_id: user.id,
      user_email: user_email.trim().toLowerCase(),
      user_name: user_name || user_email,
      role: 'member',
      status: 'pending',
      ...(invitedByUserId ? { invited_by_user_id: invitedByUserId } : {}),
    });

    return Response.json({ success: true, pending: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
