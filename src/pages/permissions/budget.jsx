export default {
  module: { key: 'module.Budget', label: 'Presupuesto', order: 6 },
  sections: [
    { key: 'budget.view', label: 'Ver Presupuesto', order: 1 },
  ],
  actions: [
    { key: 'budget.view.recommendations', parent: 'budget.view', label: 'Recomendaciones' },
    { key: 'budget.view.health',          parent: 'budget.view', label: 'Salud Financiera' },
    // New keys (Paso 2)
    { key: 'budget.view.cards',           parent: 'budget.view', label: 'Tarjetas de resumen' },
    { key: 'budget.view.chart',           parent: 'budget.view', label: 'Gráfico de barras' },
    { key: 'budget.view.period_selector', parent: 'budget.view', label: 'Selector de periodo' },
  ],
  defaults: {
    admin: {
      'budget.view':                  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'budget.view.recommendations':  { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'budget.view.health':           { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'budget.view.cards':            { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'budget.view.chart':            { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'budget.view.period_selector':  { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    },
    member: {
      'module.Budget':                { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'budget.view':                  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'budget.view.recommendations':  { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'budget.view.health':           { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'budget.view.cards':            { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'budget.view.chart':            { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'budget.view.period_selector':  { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    },
  },
};