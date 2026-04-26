export default {
  module: { key: 'module.Capture', label: 'Registrar', order: 3 },
  sections: [
    { key: 'capture.form',      label: 'Formulario de Captura', order: 1 },
    { key: 'capture.ai_assist', label: 'Asistencia IA',         order: 2 },
    { key: 'capture.input',     label: 'Métodos de Entrada',    order: 3 },
    { key: 'capture.fields',    label: 'Campos Sensibles',      order: 4 },
  ],
  actions: [
    { key: 'capture.form.basic',            parent: 'capture.form',      label: 'Campos Básicos' },
    { key: 'capture.form.advanced',         parent: 'capture.form',      label: 'Opciones Avanzadas' },
    { key: 'capture.ai_assist.suggestions', parent: 'capture.ai_assist', label: 'Sugerencias Automáticas' },

    // Phase 3 — input methods
    { key: 'capture.input.voice',      parent: 'capture.input',  label: 'Entrada por Voz' },
    { key: 'capture.input.photo',      parent: 'capture.input',  label: 'Escanear Ticket' },
    { key: 'capture.input.ai_extract', parent: 'capture.input',  label: 'Entender con IA' },

    // Phase 3 — sensitive fields
    { key: 'capture.fields.amount.edit',   parent: 'capture.fields', label: 'Editar Monto' },
    { key: 'capture.fields.date.edit',     parent: 'capture.fields', label: 'Editar Fecha (backdating)' },
    { key: 'capture.fields.invoice.toggle',parent: 'capture.fields', label: 'Toggle Factura' },
  ],
  defaults: {
    admin: {
      'capture.form':                 { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'capture.form.basic':           { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'capture.form.advanced':        { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'capture.ai_assist':            { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'capture.ai_assist.suggestions':{ can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'capture.input':                { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'capture.input.voice':          { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'capture.input.photo':          { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'capture.input.ai_extract':     { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'capture.fields':               { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'capture.fields.amount.edit':   { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'capture.fields.date.edit':     { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'capture.fields.invoice.toggle':{ can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
    },
    member: {
      'capture.form':                 { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'capture.form.basic':           { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'capture.form.advanced':        { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'capture.ai_assist':            { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'capture.ai_assist.suggestions':{ can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'capture.input':                { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'capture.input.voice':          { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'capture.input.photo':          { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'capture.input.ai_extract':     { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'capture.fields':               { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'capture.fields.amount.edit':   { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'capture.fields.date.edit':     { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'capture.fields.invoice.toggle':{ can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true  },
    },
  },
};
