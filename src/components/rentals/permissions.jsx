const ALL  = { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true };
const READ = { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true };

export default {
  module: { key: 'module.Rentals', label: 'Rentas', order: 10 },
  sections: [
    { key: 'rental.view',     label: 'Ver Propiedades',       order: 1 },
    { key: 'rental.property', label: 'Gestionar Propiedades', order: 2 },
    { key: 'rental.payments', label: 'Pagos de Renta',        order: 3 },
  ],
  actions: [
    { key: 'rental.view.list',         parent: 'rental.view',     label: 'Listar Propiedades' },
    { key: 'rental.view.detail',       parent: 'rental.view',     label: 'Detalles de Propiedad' },
    { key: 'rental.view.detail_sheet', parent: 'rental.view',     label: 'Hoja de detalle' },

    { key: 'rental.property.create',   parent: 'rental.property', label: 'Registrar Propiedad' },
    { key: 'rental.property.edit',     parent: 'rental.property', label: 'Editar Propiedad' },
    { key: 'rental.property.delete',   parent: 'rental.property', label: 'Eliminar Propiedad' },

    { key: 'rental.payments.record',   parent: 'rental.payments', label: 'Registrar Cobro' },
    { key: 'rental.payments.reverse',  parent: 'rental.payments', label: 'Revertir Cobro' },
    { key: 'rental.payments.history',  parent: 'rental.payments', label: 'Historial de Cobros' },
  ],
  defaults: {
    admin: {
      'rental.view':              ALL,
      'rental.view.list':         ALL,
      'rental.view.detail':       ALL,
      'rental.view.detail_sheet': ALL,
      'rental.property':          ALL,
      'rental.property.create':   ALL,
      'rental.property.edit':     ALL,
      'rental.property.delete':   ALL,
      'rental.payments':          ALL,
      'rental.payments.record':   ALL,
      'rental.payments.reverse':  ALL,
      'rental.payments.history':  ALL,
    },
    member: {
      'rental.view':              ALL,
      'rental.view.list':         READ,
      'rental.view.detail':       READ,
      'rental.view.detail_sheet': READ,
      'rental.property':          ALL,
      'rental.property.create':   ALL,
      'rental.property.edit':     ALL,
      'rental.property.delete':   ALL,
      'rental.payments':          ALL,
      'rental.payments.record':   ALL,
      'rental.payments.reverse':  ALL,
      'rental.payments.history':  READ,
    },
  },
};