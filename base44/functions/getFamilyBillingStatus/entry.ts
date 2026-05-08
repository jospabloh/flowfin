import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Admin-only function: returns all families with their billing/license info.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: requiere rol admin del sistema' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { search } = body;

    let families = await base44.asServiceRole.entities.Family.list('-created_date', 200);

    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      families = families.filter(f =>
        f.name?.toLowerCase().includes(q) ||
        f.join_code?.toLowerCase().includes(q) ||
        f.id?.toLowerCase().includes(q)
      );
    }

    // Attach approved member counts and creator email for context
    const result = await Promise.all(families.map(async (f) => {
      const members = await base44.asServiceRole.entities.FamilyMembership.filter({
        family_id: f.id,
        status: 'approved',
      });

      const adminMembership = members.find(m => m.user_id === f.admin_user_id && m.role === 'admin');
      const creator_email = adminMembership?.user_email ?? null;

      return { ...f, member_count: members.length, creator_email };
    }));

    return Response.json({ families: result });
  } catch (error) {
    console.error('[getFamilyBillingStatus] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});