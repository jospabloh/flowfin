const ALL  = { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true };
const READ = { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true };

export default {
  module: { key: 'module.Dashboard', label: 'Inicio', order: 1 },
  sections: [
    { key: 'dashboard.view', label: 'Ver Dashboard', order: 1 },
  ],
  actions: [
    { key: 'dashboard.view.summary',  parent: 'dashboard.view', label: 'Resumen de Gastos' },
    { key: 'dashboard.view.upcoming', parent: 'dashboard.view', label: 'Pagos Próximos' },
    { key: 'dashboard.view.analytics',parent: 'dashboard.view', label: 'Analítica Básica' },
    { key: 'dashboard.view.recent',   parent: 'dashboard.view', label: 'Movimientos recientes' },
    { key: 'dashboard.view.alerts',   parent: 'dashboard.view', label: 'Alertas y banners' },
    { key: 'dashboard.view.filters',  parent: 'dashboard.view', label: 'Filtros del dashboard' },
  ],
  defaults: {
    admin: {
      'dashboard.view':          ALL,
      'dashboard.view.summary':  ALL,
      'dashboard.view.upcoming': ALL,
      'dashboard.view.analytics':ALL,
      'dashboard.view.recent':   ALL,
      'dashboard.view.alerts':   ALL,
      'dashboard.view.filters':  ALL,
    },
    member: {
      'module.Dashboard':        READ,
      'dashboard.view':          ALL,
      'dashboard.view.summary':  READ,
      'dashboard.view.upcoming': READ,
      'dashboard.view.analytics':READ,
      'dashboard.view.recent':   READ,
      'dashboard.view.alerts':   READ,
      'dashboard.view.filters':  READ,
    },
  },
};