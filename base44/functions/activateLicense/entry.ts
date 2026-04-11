import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Admin-only function: manually activates or modifies a family license.
// Only callable by app-level admins (user.role === 'admin').
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: requiere rol admin del sistema' }, { status: 403 });

    const {
      family_id,
      billing_status,
      license_plan,
      licensed_member_limit,
      payment_reference,
      activation_notes,
      license_expires_at,
    } = await req.json();

    if (!family_id) return Response.json({ error: 'family_id requerido' }, { status: 400 });

    const PLAN_LIMITS = { home: 4, family_plus: 10, circle: 20 };
    const plan = license_plan || 'home';
    const memberLimit = licensed_member_limit || PLAN_LIMITS[plan] || 4;

    const updateData = {
      billing_status: billing_status || 'active',
      license_plan: plan,
      licensed_member_limit: memberLimit,
      license_activated_at: new Date().toISOString(),
      activated_by_admin: user.email,
    };

    if (payment_reference !== undefined) updateData.payment_reference = payment_reference;
    if (activation_notes !== undefined) updateData.activation_notes = activation_notes;
    if (license_expires_at) updateData.license_expires_at = new Date(license_expires_at).toISOString();

    await base44.asServiceRole.entities.Family.update(family_id, updateData);

    console.log(`[activateLicense] Family ${family_id} activated by ${user.email}. Status: ${updateData.billing_status}, Plan: ${plan}`);

    return Response.json({ success: true, family_id, billing_status: updateData.billing_status, license_plan: plan });
  } catch (error) {
    console.error('[activateLicense] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});