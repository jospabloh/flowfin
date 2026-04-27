export default {
  module: { key: 'module.AIUsage', label: 'Uso de IA', order: 17 },
  sections: [
    { key: 'ai.usage', label: 'Ver Uso', order: 1 },
  ],
  actions: [
    { key: 'ai.usage.view',   parent: 'ai.usage', label: 'Historial de Consumo' },
    // New keys (Paso 2)
    { key: 'ai.usage.export', parent: 'ai.usage', label: 'Exportar Historial' },
  ],
  defaults: {
    admin: {
      'ai.usage':        { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'ai.usage.view':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'ai.usage.export': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
    member: {
      'ai.usage':        { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'ai.usage.view':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'ai.usage.export': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
  },
};
