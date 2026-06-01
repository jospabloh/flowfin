export default {
  module: { key: 'module.Rentals', label: 'Rentas', order: 10 },
  sections: [
    { key: 'rental.view',     label: 'Ver Propiedades',      order: 1 },
    { key: 'rental.property', label: 'Gestionar Propiedades',order: 2 },
    { key: 'rental.payments', label: 'Pagos de Renta',        order: 3 },
  ],
  actions: [
    { key: 'rental.view.list',         parent: 'rental.view',     label: 'Listar Propiedades' },
    { key: 'rental.view.detail',       parent: 'rental.view',     label: 'Detalles de Propiedad' },
    // New keys (Paso 2)
    { key: 'rental.view.detail_sheet', parent: 'rental.view',     label: 'Hoja de detalle' },

    { key: 'rental.property.create',   parent: 'rental.property', label: 'Registrar Propiedad' },
    { key: 'rental.property.edit',     parent: 'rental.property', label: 'Editar Propiedad' },
    { key: 'rental.property.delete',   parent: 'rental.property', label: 'Eliminar Propiedad' },

    { key: 'rental.payments.record',   parent: 'rental.payments', label: 'Registrar Pago' },
    { key: 'rental.payments.reverse',  parent: 'rental.payments', label: 'Revertir Pago' },
    // New keys (Paso 2)
    { key: 'rental.payments.history',  parent: 'rental.payments', label: 'Historial de Pagos' },
  ],
  defaults: {
    admin: {
      'rental.view':              { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'rental.view.list':         { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'rental.view.detail':       { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'rental.view.detail_sheet': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'rental.property':          { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'rental.property.create':   { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'rental.property.edit':     { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'rental.property.delete':   { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'rental.payments':          { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'rental.payments.record':   { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'rental.payments.reverse':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'rental.payments.history':  { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    },
    member: {
      'rental.view':              { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'rental.view.list':         { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'rental.view.detail':       { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'rental.view.detail_sheet': { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'rental.property':          { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'rental.property.create':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'rental.property.edit':     { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'rental.property.delete':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'rental.payments':          { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'rental.payments.record':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'rental.payments.reverse':  { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'rental.payments.history':  { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
  },
};
