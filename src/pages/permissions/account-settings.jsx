export default {
  module: { key: 'module.AccountSettings', label: 'Mi Cuenta', order: 13 },
  sections: [
    { key: 'account.profile', label: 'Perfil', order: 1 },
  ],
  actions: [
    { key: 'account.profile.view',     parent: 'account.profile', label: 'Ver Información' },
    { key: 'account.profile.edit',     parent: 'account.profile', label: 'Editar Perfil' },
    // New keys (Paso 2)
    { key: 'account.profile.password', parent: 'account.profile', label: 'Cambiar Contraseña' },
    { key: 'account.profile.delete',   parent: 'account.profile', label: 'Eliminar Cuenta' },
  ],
  defaults: {
    admin: {
      'account.profile':          { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'account.profile.view':     { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'account.profile.edit':     { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'account.profile.password': { can_read: true, can_write: true,  can_modify: true,  can_delete: false, can_view: true },
      'account.profile.delete':   { can_read: true, can_write: false, can_modify: false, can_delete: true,  can_view: true },
    },
    member: {
      'module.AccountSettings':   { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'account.profile':          { can_read: true, can_write: true,  can_modify: true,  can_delete: false, can_view: true },
      'account.profile.view':     { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'account.profile.edit':     { can_read: true, can_write: true,  can_modify: true,  can_delete: false, can_view: true },
      'account.profile.password': { can_read: true, can_write: true,  can_modify: true,  can_delete: false, can_view: true },
      'account.profile.delete':   { can_read: true, can_write: false, can_modify: false, can_delete: true,  can_view: true },
    },
  },
};