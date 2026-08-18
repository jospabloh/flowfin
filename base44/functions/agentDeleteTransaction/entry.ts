import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Guard helpers — inlined (no local imports in Deno deploy)

async function resolveFamily(base44, user) {
  const sr = base44.asServiceRole.entities;
  let memberships = await sr.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
  if (!memberships.length) memberships = await sr.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
  if (!memberships.length) throw Object.assign(new Error('No tienes acceso a ninguna familia activa.'), { httpStatus: 403 });
  const activeId = user.data?.family_id ?? user.data?.data?.family_id;
  const membership = memberships.find(m => m.family_id === activeId)
    ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
  return { familyId: membership.family_id, selfPersonId: membership.person_id ?? null };
}

async function assertRefInFamily(userEntities, entity, id, familyId, label) {
  const rows = await userEntities[entity].filter({ id, family_id: familyId });
  if (!rows || !rows.length) {
    throw Object.assign(new Error(`${label} no pertenece a tu familia o no existe.`), { httpStatus: 400 });
  }
}

// Mirrors _agentGuard.ts's assertBillingAllowed (inlined — see resolveFamily
// above). Was missing entirely: an AI-assistant transaction delete used to
// bypass validateMutationAllowed's read-only-mode gate outright.
async function assertBillingAllowed(base44, familyId, user) {
  if (user.role === 'admin') return;
  const fam = await base44.asServiceRole.entities.Family.get(familyId).catch(() => null);
  const status = fam?.billing_status ?? 'active';
  if (status === 'view_only' || status === 'suspended') {
    throw Object.assign(
      new Error('Tu suscripción está en modo solo lectura; no puedo registrar cambios ahora.'),
      { httpStatus: 403 },
    );
  }
}

// Deletes a transaction that belongs to the caller's family.
// IMPORTANT: Use base44.entities (user-context) for family-scoped reads.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { familyId } = await resolveFamily(base44, user);
    await assertBillingAllowed(base44, familyId, user);
    const ue = base44.entities;

    const body = await req.json().catch(() => ({}));
    const id = body.id;
    if (!id) return Response.json({ error: 'missing_required_fields', fields: ['id'] }, { status: 400 });

    // Verify transaction belongs to this family
    await assertRefInFamily(ue, 'Transaction', String(id), familyId, 'El movimiento');
    await ue.Transaction.delete(String(id));
    return Response.json({ ok: true, id });
  } catch (error) {
    const status = error.httpStatus || 500;
    console.error('agentDeleteTransaction error:', error);
    return Response.json({ error: error.message || 'internal' }, { status });
  }
});