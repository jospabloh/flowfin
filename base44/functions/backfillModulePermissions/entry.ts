import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const KEYS_TO_BACKFILL = ['module.Trips', 'module.Goals'];

const PERM_BASE = {
  role: 'member',
  can_view: true,
  can_read: true,
  can_write: false,
  can_modify: false,
  can_delete: false,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all families
    const families = await base44.asServiceRole.entities.Family.list();
    if (!families?.length) {
      return Response.json({ message: 'No families found', created: 0 });
    }

    // Fetch all existing RolePermission records for these keys
    const existingPerms = await base44.asServiceRole.entities.RolePermission.filter({
      role: 'member',
    });

    // Build a set of "familyId:key" for quick lookup
    const existingSet = new Set(
      (existingPerms || [])
        .filter(p => KEYS_TO_BACKFILL.includes(p.permission_key))
        .map(p => `${p.family_id}:${p.permission_key}`)
    );

    const toCreate = [];
    for (const family of families) {
      for (const key of KEYS_TO_BACKFILL) {
        if (!existingSet.has(`${family.id}:${key}`)) {
          toCreate.push({ ...PERM_BASE, family_id: family.id, permission_key: key });
        }
      }
    }

    if (toCreate.length === 0) {
      return Response.json({ message: 'All families already have these permissions', created: 0 });
    }

    // Bulk create in batches of 50
    const batchSize = 50;
    let created = 0;
    for (let i = 0; i < toCreate.length; i += batchSize) {
      const batch = toCreate.slice(i, i + batchSize);
      await base44.asServiceRole.entities.RolePermission.bulkCreate(batch);
      created += batch.length;
    }

    return Response.json({
      message: `Backfill complete`,
      families_processed: families.length,
      created,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});