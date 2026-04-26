export default {
  module: { key: 'module.LicenseAdmin', label: 'Mi Licencia', order: 16 },
  sections: [
    { key: 'license.manage', label: 'Gestionar Licencia', order: 1 },
  ],
  actions: [
    { key: 'license.manage.view',       parent: 'license.manage', label: 'Ver Licencia' },
    { key: 'license.manage.activate',   parent: 'license.manage', label: 'Activar Licencia' },
    // New keys (Paso 2)
    { key: 'license.manage.deactivate', parent: 'license.manage', label: 'Desactivar Licencia' },
  ],
  defaults: {
    admin: {
      'license.manage':            { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'license.manage.view':       { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'license.manage.activate':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'license.manage.deactivate': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
    member: {
      'license.manage':            { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'license.manage.view':       { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'license.manage.activate':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'license.manage.deactivate': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
  },
};
