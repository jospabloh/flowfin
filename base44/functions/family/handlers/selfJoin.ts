import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

export async function handle(req: Request, body: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { join_code, user_email, user_name, ref } = body;

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

    // Check for existing membership
    const existingByEmail = await base44.asServiceRole.entities.FamilyMembership.filter({
      family_id: family.id,
      user_email: user_email.trim().toLowerCase(),
    });

    const alreadyApproved = existingByEmail.find(m => m.status === 'approved');
    if (alreadyApproved) {
      const userData = { ...(user.data || {}), family_id: family.id };
      delete userData.data;
      await base44.asServiceRole.entities.User.update(user.id, { data: userData });
      return Response.json({ success: true, already_member: true });
    }

    const alreadyPending = existingByEmail.find(m => m.status === 'pending');
    if (alreadyPending) {
      return Response.json({ success: true, pending: true });
    }

    // Block if family is suspended
    if (family.billing_status === 'suspended') {
      return Response.json({ error: 'Esta familia está suspendida. Contacta al administrador.' }, { status: 403 });
    }

    // Create pending membership (requires admin approval)
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
