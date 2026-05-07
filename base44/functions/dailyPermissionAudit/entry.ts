import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const AUDIT_EMAIL = 'h.josepablo@gmail.com';
const ADMIN_FULL  = { can_read: true, can_write: true, can_modify: true, can_delete: true,  can_view: true };
const MEMBER_BASE = { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true };

// All permission keys that every family should have for both admin and member
const ALL_PERMISSION_KEYS = [
  'module.Dashboard',
  'module.Transactions',
  'module.Reports',
  'module.Investments',
  'module.MSI',
  'module.Rentals',
  'module.ScheduledPayments',
  'module.Budget',
  'module.Assistant',
  'module.Catalogs',
  'module.FamilySettings',
  'module.Trips',
  'module.Goals',
  'module.FamilyAdmin',
  'module.PermissionAdmin',
];

function fmtDate(d) {
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildEmailHtml(stats) {
  const allOk = (stats.created_admin + stats.created_member) === 0 && stats.errors.length === 0;
  const statusBadge = stats.errors.length > 0
    ? '<span style="color:#dc2626;font-weight:700">⚠️ Con errores</span>'
    : allOk
      ? '<span style="color:#059669;font-weight:700">✅ Todo en orden</span>'
      : '<span style="color:#d97706;font-weight:700">🔧 Permisos creados</span>';

  const createdList = stats.created_keys.length === 0
    ? '<p style="color:#6b7280;font-style:italic">Ningún permiso nuevo — todo estaba en orden.</p>'
    : `<ul style="margin:0;padding-left:1.2em;font-size:13px;color:#374151">
        ${stats.created_keys.slice(0, 100).map(k => `<li><code>${k}</code></li>`).join('')}
        ${stats.created_keys.length > 100 ? `<li style="color:#6b7280">... y ${stats.created_keys.length - 100} más</li>` : ''}
       </ul>`;

  const errorBlock = stats.errors.length > 0
    ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px;color:#991b1b">
        <strong>Errores (${stats.errors.length}):</strong>
        <ul style="margin:4px 0 0;padding-left:1.2em">${stats.errors.map(e => `<li>${e}</li>`).join('')}</ul>
       </div>`
    : '';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,sans-serif;background:#f1f5f9;margin:0;padding:16px}
.w{max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.h{background:linear-gradient(135deg,#059669,#047857);padding:24px 32px;color:#fff}
.h h1{margin:0;font-size:18px;font-weight:700}
.h p{margin:4px 0 0;color:#a7f3d0;font-size:12px}
.b{padding:24px 32px;color:#374151;line-height:1.7;font-size:15px}
.b p{margin:0 0 12px}
.g{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px;color:#166534}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:14px}
.row:last-child{border-bottom:none}
.num{font-weight:700;color:#059669}
.f{padding:16px 32px;background:#f8fafc;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
.f a{color:#059669}
</style></head><body><div class="w">
<div class="h"><h1>🔐 FlowFin — Auditoría de Permisos</h1><p>${stats.runDate} · Ejecución automática nocturna</p></div>
<div class="b">
  <p>Estado: ${statusBadge}</p>
  <div class="g">
    <div class="row"><span>Familias auditadas</span><span class="num">${stats.families_count}</span></div>
    <div class="row"><span>Permission keys por familia</span><span class="num">${ALL_PERMISSION_KEYS.length}</span></div>
    <div class="row"><span>Admin: ya existían</span><span class="num">${stats.existing_admin}</span></div>
    <div class="row"><span>Admin: creados</span><span class="num" style="color:${stats.created_admin > 0 ? '#d97706' : '#059669'}">${stats.created_admin}</span></div>
    <div class="row"><span>Member: ya existían</span><span class="num">${stats.existing_member}</span></div>
    <div class="row" style="border-bottom:none"><span>Member: creados</span><span class="num" style="color:${stats.created_member > 0 ? '#d97706' : '#059669'}">${stats.created_member}</span></div>
  </div>
  ${stats.created_keys.length > 0 ? '<p><strong>Permisos nuevos creados:</strong></p>' : ''}
  ${createdList}
  ${errorBlock}
</div>
<div class="f">FlowFin — <strong>ACACIA Consultoría</strong> &nbsp;·&nbsp; <a href="mailto:soporte@acaciaco.com.mx">soporte@acaciaco.com.mx</a></div>
</div></body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const runDate = fmtDate(now);

    const stats = {
      runDate,
      families_count: 0,
      existing_admin: 0,
      created_admin: 0,
      existing_member: 0,
      created_member: 0,
      created_keys: [],
      errors: [],
    };

    const families = await base44.asServiceRole.entities.Family.list();
    if (!families?.length) {
      return Response.json({ message: 'No families found', stats });
    }
    stats.families_count = families.length;

    const [existingAdmin, existingMember] = await Promise.all([
      base44.asServiceRole.entities.RolePermission.filter({ role: 'admin' }),
      base44.asServiceRole.entities.RolePermission.filter({ role: 'member' }),
    ]);

    const adminSet = new Set((existingAdmin || []).map(p => `${p.family_id}:${p.permission_key}`));
    const memberSet = new Set((existingMember || []).map(p => `${p.family_id}:${p.permission_key}`));

    const toCreate = [];

    for (const family of families) {
      for (const key of ALL_PERMISSION_KEYS) {
        const fk = `${family.id}:${key}`;
        if (adminSet.has(fk)) {
          stats.existing_admin++;
        } else {
          toCreate.push({ family_id: family.id, role: 'admin', permission_key: key, ...ADMIN_FULL });
          stats.created_admin++;
          stats.created_keys.push(`[admin] ${key} (...${family.id.slice(-6)})`);
        }
        if (memberSet.has(fk)) {
          stats.existing_member++;
        } else {
          toCreate.push({ family_id: family.id, role: 'member', permission_key: key, ...MEMBER_BASE });
          stats.created_member++;
          stats.created_keys.push(`[member] ${key} (...${family.id.slice(-6)})`);
        }
      }
    }

    for (let i = 0; i < toCreate.length; i += 50) {
      try {
        await base44.asServiceRole.entities.RolePermission.bulkCreate(toCreate.slice(i, i + 50));
      } catch (e) {
        stats.errors.push(`Batch ${Math.floor(i / 50) + 1}: ${e.message}`);
      }
    }

    const totalCreated = stats.created_admin + stats.created_member;

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: AUDIT_EMAIL,
        subject: `[FlowFin] Permisos · ${totalCreated > 0 ? `${totalCreated} creados` : 'todo OK'} · ${runDate}`,
        body: buildEmailHtml(stats),
        from_name: 'FlowFin Audit',
      });
    } catch (emailErr) {
      stats.errors.push(`Email: ${emailErr.message}`);
    }

    console.log(`[dailyPermissionAudit] families:${stats.families_count} admin_created:${stats.created_admin} member_created:${stats.created_member} errors:${stats.errors.length}`);
    return Response.json({ success: true, ...stats });
  } catch (err) {
    console.error(`[dailyPermissionAudit] Fatal: ${err.message}`);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});