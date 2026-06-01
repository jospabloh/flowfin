import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Returns safe session context for Finia: user display name, family name, role.
// Never returns raw IDs, tokens, or data from another tenant.
// family_id is resolved entirely server-side from the authenticated session.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const entities = base44.asServiceRole.entities;

    // Resolve approved membership — never trust client-sent family_id
    let memberships = await entities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) {
      memberships = await entities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    }
    if (!memberships.length) {
      return Response.json({ error: 'No tienes acceso a ninguna familia activa.' }, { status: 403 });
    }

    // Pick the most recently active membership
    const activeId = user.data?.family_id ?? user.data?.data?.family_id;
    const membership = memberships.find(m => m.family_id === activeId)
      ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];

    const familyId = membership.family_id;

    // Get family name
    let familyName = null;
    try {
      const families = await entities.Family.filter({ id: familyId });
      familyName = families?.[0]?.name ?? null;
    } catch { /* ignore */ }

    // Get person name linked to this membership
    let personName = membership.user_name ?? user.full_name ?? user.email ?? null;
    if (membership.person_id) {
      try {
        const persons = await entities.Person.filter({ id: membership.person_id, family_id: familyId });
        if (persons?.[0]?.name) personName = persons[0].name;
      } catch { /* ignore */ }
    }

    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const monthLabel = `${today.toLocaleString('es-MX', { month: 'long' })} ${today.getFullYear()}`;

    return Response.json({
      user_name: personName,
      family_name: familyName,
      role: membership.role ?? 'member',
      current_date: todayISO,
      current_month_label: monthLabel,
      capabilities: [
        'Registrar gastos e ingresos desde texto',
        'Escanear recibos e imágenes',
        'Consultar resumen financiero mensual',
        'Revisar presupuestos y alertas',
        'Revisar pagos próximos',
        'Detectar posibles duplicados',
        'Analizar comportamiento de gasto',
        'Sugerir mejoras financieras',
      ],
    });
  } catch (error) {
    console.error('finiaGetSecureContext error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});