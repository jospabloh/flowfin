// docs.permissions.js covers TWO modules: UserManual + About
// The aggregator handles arrays of manifest objects.
export default [
  {
    module: { key: 'module.UserManual', label: 'Manual', order: 18 },
    sections: [
      { key: 'docs.manual', label: 'Ver Manual', order: 1 },
    ],
    actions: [
      { key: 'docs.manual.view', parent: 'docs.manual', label: 'Acceder Documentación' },
    ],
    defaults: {
      admin: {
        'docs.manual':      { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
        'docs.manual.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      },
      member: {
        'docs.manual':      { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
        'docs.manual.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      },
    },
  },
  {
    module: { key: 'module.About', label: 'Acerca de', order: 19 },
    sections: [
      { key: 'docs.about', label: 'Ver Información', order: 1 },
    ],
    actions: [
      { key: 'docs.about.view', parent: 'docs.about', label: 'Acceder Información' },
    ],
    defaults: {
      admin: {
        'docs.about':      { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
        'docs.about.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      },
      member: {
        'docs.about':      { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
        'docs.about.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      },
    },
  },
];
