export default {
  module: { key: 'module.SavingsDashboard', label: 'Ahorros', order: 22 },
  sections: [
    { key: 'savings.view', label: 'Ver Oportunidades de Ahorro', order: 1 },
  ],
  actions: [
    { key: 'savings.view.summary',       parent: 'savings.view', label: 'Resumen de ahorros' },
    { key: 'savings.view.subscriptions', parent: 'savings.view', label: 'Suscripciones olvidadas' },
    { key: 'savings.view.opportunities', parent: 'savings.view', label: 'Oportunidades no esenciales' },
    { key: 'savings.view.refresh',       parent: 'savings.view', label: 'Actualizar análisis' },
  ],
  defaults: {
    admin: {
      'savings.view':                  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'savings.view.summary':          { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'savings.view.subscriptions':    { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'savings.view.opportunities':    { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'savings.view.refresh':          { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    },
    member: {
      'savings.view':                  { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'savings.view.summary':          { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'savings.view.subscriptions':    { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'savings.view.opportunities':    { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'savings.view.refresh':          { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
  },
};
