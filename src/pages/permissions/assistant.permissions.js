export default {
  module: { key: 'module.Assistant', label: 'Asistente IA', order: 5 },
  sections: [
    { key: 'assistant.chat',     label: 'Chat',           order: 1 },
    { key: 'assistant.features', label: 'Características', order: 2 },
  ],
  actions: [
    { key: 'assistant.chat.send',               parent: 'assistant.chat',     label: 'Enviar Mensajes' },
    { key: 'assistant.chat.voice',              parent: 'assistant.chat',     label: 'Entrada de Voz' },
    // New keys (Paso 2)
    { key: 'assistant.chat.clear',              parent: 'assistant.chat',     label: 'Limpiar conversación' },

    { key: 'assistant.features.receipt',        parent: 'assistant.features', label: 'Escanear Tickets' },
    { key: 'assistant.features.register',       parent: 'assistant.features', label: 'Registrar Movimientos' },
    // New keys (Paso 2)
    { key: 'assistant.features.predictive_chips', parent: 'assistant.features', label: 'Chips predictivos' },
    // Phase 3
    { key: 'assistant.features.receipt.scan',   parent: 'assistant.features', label: 'Botón Escanear Recibo' },
  ],
  defaults: {
    admin: {
      'assistant.chat':                      { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'assistant.chat.send':                 { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'assistant.chat.voice':                { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'assistant.chat.clear':                { can_read: true, can_write: true,  can_modify: false, can_delete: true,  can_view: true },
      'assistant.features':                  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'assistant.features.receipt':          { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'assistant.features.register':         { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'assistant.features.predictive_chips': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'assistant.features.receipt.scan':     { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
    },
    member: {
      'assistant.chat':                      { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'assistant.chat.send':                 { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'assistant.chat.voice':                { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'assistant.chat.clear':                { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'assistant.features':                  { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'assistant.features.receipt':          { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'assistant.features.register':         { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'assistant.features.predictive_chips': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'assistant.features.receipt.scan':     { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
    },
  },
};
