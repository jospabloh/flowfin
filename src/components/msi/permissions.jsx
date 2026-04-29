const ALL  = { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true };
const READ = { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true };
const NONE = { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false };

export default {
  module: { key: 'module.MSI', label: 'MSI', order: 9 },
  sections: [
    { key: 'msi.view',     label: 'Ver MSI',      order: 1 },
    { key: 'msi.crud',     label: 'Gestionar MSI', order: 2 },
    { key: 'msi.payments', label: 'Pagos MSI',     order: 3 },
  ],
  actions: [
    { key: 'msi.view.list',         parent: 'msi.view',     label: 'Listar MSI' },
    { key: 'msi.view.detail',       parent: 'msi.view',     label: 'Detalles' },
    { key: 'msi.view.detail_sheet', parent: 'msi.view',     label: 'Hoja de detalle' },
    { key: 'msi.crud.create',       parent: 'msi.crud',     label: 'Crear MSI' },
    { key: 'msi.crud.edit',         parent: 'msi.crud',     label: 'Editar MSI' },
    { key: 'msi.crud.delete',       parent: 'msi.crud',     label: 'Eliminar MSI' },
    { key: 'msi.payments.add',      parent: 'msi.payments', label: 'Registrar Pago' },
    { key: 'msi.payments.history',  parent: 'msi.payments', label: 'Historial de Pagos' },
  ],
  defaults: {
    admin: {
      'module.MSI':             ALL,
      'msi.view':               ALL,
      'msi.view.list':          ALL,
      'msi.view.detail':        ALL,
      'msi.view.detail_sheet':  ALL,
      'msi.crud':               ALL,
      'msi.crud.create':        ALL,
      'msi.crud.edit':          ALL,
      'msi.crud.delete':        ALL,
      'msi.payments':           ALL,
      'msi.payments.add':       ALL,
      'msi.payments.history':   ALL,
    },
    member: {
      'module.MSI':             READ,
      'msi.view':               ALL,
      'msi.view.list':          READ,
      'msi.view.detail':        READ,
      'msi.view.detail_sheet':  READ,
      'msi.crud':               ALL,
      'msi.crud.create':        ALL,
      'msi.crud.edit':          ALL,
      'msi.crud.delete':        ALL,
      'msi.payments':           ALL,
      'msi.payments.add':       ALL,
      'msi.payments.history':   READ,
    },
  },
};