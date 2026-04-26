export default {
  module: { key: 'module.Dashboard', label: 'Inicio', order: 1 },
  sections: [
    { key: 'dashboard.view', label: 'Ver Dashboard', order: 1 },
  ],
  actions: [
    { key: 'dashboard.view.summary',  parent: 'dashboard.view', label: 'Resumen de Gastos' },
    { key: 'dashboard.view.upcoming', parent: 'dashboard.view', label: 'Pagos Próximos' },
    { key: 'dashboard.view.analytics',parent: 'dashboard.view', label: 'Análitica Básica' },
    // New keys (Paso 2)
    { key: 'dashboard.view.recent',   parent: 'dashboard.view', label: 'Movimientos recientes' },
    { key: 'dashboard.view.alerts',   parent: 'dashboard.view', label: 'Alertas y banners' },
    { key: 'dashboard.view.filters',  parent: 'dashboard.view', label: 'Filtros del dashboard' },
  ],
  defaults: {
    admin: {
      'dashboard.view':          { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'dashboard.view.summary':  { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'dashboard.view.upcoming': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'dashboard.view.analytics':{ can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'dashboard.view.recent':   { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'dashboard.view.alerts':   { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'dashboard.view.filters':  { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    },
    member: {
      'dashboard.view':          { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'dashboard.view.summary':  { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'dashboard.view.upcoming': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'dashboard.view.analytics':{ can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'dashboard.view.recent':   { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'dashboard.view.alerts':   { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'dashboard.view.filters':  { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    },
  },
};
