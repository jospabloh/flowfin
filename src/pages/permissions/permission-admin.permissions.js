export default {
  module: { key: 'module.PermissionAdmin', label: 'Permisos', order: 15 },
  sections: [
    { key: 'permission.manage', label: 'Gestionar Permisos', order: 1 },
  ],
  actions: [
    { key: 'permission.manage.view',  parent: 'permission.manage', label: 'Ver Matriz' },
    { key: 'permission.manage.edit',  parent: 'permission.manage', label: 'Editar Permisos' },
    { key: 'permission.manage.reset', parent: 'permission.manage', label: 'Restablecer Valores' },
  ],
  defaults: {
    admin: {
      'permission.manage':       { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'permission.manage.view':  { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'permission.manage.edit':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'permission.manage.reset': { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
    },
    member: {
      'permission.manage':       { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'permission.manage.view':  { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'permission.manage.edit':  { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'permission.manage.reset': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
  },
};
