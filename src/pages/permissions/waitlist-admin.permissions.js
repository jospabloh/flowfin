export default {
  module: { key: 'module.WaitlistAdmin', label: 'Waitlist Admin', order: 24 },
  sections: [
    { key: 'waitlist.manage', label: 'Gestionar Waitlist', order: 1 },
  ],
  actions: [
    { key: 'waitlist.manage.view',   parent: 'waitlist.manage', label: 'Ver Lista de Espera' },
    { key: 'waitlist.manage.invite', parent: 'waitlist.manage', label: 'Invitar Usuario' },
    { key: 'waitlist.manage.bulk',   parent: 'waitlist.manage', label: 'Invitar en Masa' },
    { key: 'waitlist.manage.export', parent: 'waitlist.manage', label: 'Exportar Lista' },
  ],
  defaults: {
    admin: {
      'waitlist.manage':        { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'waitlist.manage.view':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'waitlist.manage.invite': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'waitlist.manage.bulk':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'waitlist.manage.export': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
    member: {
      'waitlist.manage':        { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'waitlist.manage.view':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'waitlist.manage.invite': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'waitlist.manage.bulk':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'waitlist.manage.export': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
  },
};
