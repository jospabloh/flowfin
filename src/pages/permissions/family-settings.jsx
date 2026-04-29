export default {
  module: { key: 'module.FamilySettings', label: 'Mi Familia', order: 12 },
  sections: [
    { key: 'family.settings', label: 'Configuración', order: 1 },
  ],
  actions: [
    { key: 'family.settings.basic',    parent: 'family.settings', label: 'Datos Básicos' },
    { key: 'family.settings.locale',   parent: 'family.settings', label: 'Idioma y Moneda' },
    { key: 'family.settings.advanced', parent: 'family.settings', label: 'Opciones Avanzadas' },
  ],
  defaults: {
    admin: {
      'family.settings':          { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'family.settings.basic':    { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'family.settings.locale':   { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'family.settings.advanced': { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
    },
    member: {
      'module.FamilySettings':    { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'family.settings':          { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'family.settings.basic':    { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'family.settings.locale':   { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'family.settings.advanced': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
  },
};