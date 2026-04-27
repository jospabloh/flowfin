const ALL  = { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true };
const READ = { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true };

export default {
  module: { key: 'module.Transactions', label: 'Movimientos', order: 2 },
  sections: [
    { key: 'transaction.view',   label: 'Ver Movimientos',     order: 1 },
    { key: 'transaction.edit',   label: 'Editar Movimiento',   order: 2 },
    { key: 'transaction.delete', label: 'Eliminar Movimiento', order: 3 },
  ],
  actions: [
    { key: 'transaction.view.list',          parent: 'transaction.view',   label: 'Listar Movimientos' },
    { key: 'transaction.view.filter',        parent: 'transaction.view',   label: 'Filtrar' },
    { key: 'transaction.view.search',        parent: 'transaction.view',   label: 'Búsqueda' },
    { key: 'transaction.view.export',        parent: 'transaction.view',   label: 'Exportar a Excel' },
    { key: 'transaction.view.pending_banner',parent: 'transaction.view',   label: 'Banner de pendientes' },

    { key: 'transaction.edit.details',       parent: 'transaction.edit',   label: 'Editar Detalles' },

    { key: 'transaction.delete.action',      parent: 'transaction.delete', label: 'Eliminar Registro' },
  ],
  defaults: {
    admin: {
      'transaction.view':                ALL,
      'transaction.view.list':           ALL,
      'transaction.view.filter':         ALL,
      'transaction.view.search':         ALL,
      'transaction.view.export':         ALL,
      'transaction.view.pending_banner': ALL,
      'transaction.edit':                ALL,
      'transaction.edit.details':        ALL,
      'transaction.delete':              ALL,
      'transaction.delete.action':       ALL,
    },
    member: {
      'transaction.view':                ALL,
      'transaction.view.list':           READ,
      'transaction.view.filter':         READ,
      'transaction.view.search':         READ,
      'transaction.view.export':         READ,
      'transaction.view.pending_banner': READ,
      'transaction.edit':                ALL,
      'transaction.edit.details':        ALL,
      'transaction.delete':              ALL,
      'transaction.delete.action':       ALL,
    },
  },
};