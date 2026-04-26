export default {
  module: { key: 'module.FamilyAdmin', label: 'Admin Familia', order: 14 },
  sections: [
    { key: 'family.admin.members', label: 'Miembros',    order: 1 },
    { key: 'family.admin.billing', label: 'Facturación', order: 2 },
  ],
  actions: [
    { key: 'family.admin.members.view',    parent: 'family.admin.members', label: 'Ver Miembros' },
    { key: 'family.admin.members.invite',  parent: 'family.admin.members', label: 'Invitar Miembro' },
    { key: 'family.admin.members.approve', parent: 'family.admin.members', label: 'Aprobar Solicitudes' },
    { key: 'family.admin.members.remove',  parent: 'family.admin.members', label: 'Eliminar Miembro' },
    // Phase 3
    { key: 'family.admin.members.link',    parent: 'family.admin.members', label: 'Vincular a Persona' },
    { key: 'family.admin.members.reject',  parent: 'family.admin.members', label: 'Rechazar Solicitudes' },

    { key: 'family.admin.billing.view',    parent: 'family.admin.billing', label: 'Ver Estado' },
    { key: 'family.admin.billing.upgrade', parent: 'family.admin.billing', label: 'Mejorar Plan' },
  ],
  defaults: {
    admin: {
      'family.admin.members':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'family.admin.members.view':    { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'family.admin.members.invite':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'family.admin.members.approve': { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'family.admin.members.remove':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'family.admin.members.link':    { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'family.admin.members.reject':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'family.admin.billing':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'family.admin.billing.view':    { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'family.admin.billing.upgrade': { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
    },
    member: {
      'family.admin.members':         { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'family.admin.members.view':    { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'family.admin.members.invite':  { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'family.admin.members.approve': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'family.admin.members.remove':  { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'family.admin.members.link':    { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'family.admin.members.reject':  { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'family.admin.billing':         { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'family.admin.billing.view':    { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'family.admin.billing.upgrade': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
  },
};
