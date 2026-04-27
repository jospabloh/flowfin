export default {
  module: { key: 'module.Capture', label: 'Registrar', order: 3 },
  sections: [
    { key: 'capture.form',      label: 'Formulario de Captura', order: 1 },
    { key: 'capture.ai_assist', label: 'Asistencia IA',         order: 2 },
  ],
  actions: [
    { key: 'capture.form.basic',            parent: 'capture.form',      label: 'Campos Básicos' },
    { key: 'capture.form.advanced',         parent: 'capture.form',      label: 'Opciones Avanzadas' },
    { key: 'capture.ai_assist.suggestions', parent: 'capture.ai_assist', label: 'Sugerencias Automáticas' },
  ],
  defaults: {
    admin: {
      'capture.form':                 { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'capture.form.basic':           { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'capture.form.advanced':        { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'capture.ai_assist':            { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'capture.ai_assist.suggestions':{ can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    },
    member: {
      'capture.form':                 { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'capture.form.basic':           { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'capture.form.advanced':        { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'capture.ai_assist':            { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'capture.ai_assist.suggestions':{ can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true  },
    },
  },
};
