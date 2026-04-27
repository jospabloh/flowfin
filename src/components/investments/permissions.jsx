const ALL  = { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true };
const READ = { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true };

export default {
  module: { key: 'module.Investments', label: 'Inversiones', order: 8 },
  sections: [
    { key: 'investment.view',     label: 'Ver Inversiones',      order: 1 },
    { key: 'investment.crud',     label: 'Gestionar Inversiones', order: 2 },
    { key: 'investment.payments', label: 'Pagos de Inversión',    order: 3 },
  ],
  actions: [
    { key: 'investment.view.list',         parent: 'investment.view',     label: 'Listar Inversiones' },
    { key: 'investment.view.detail',       parent: 'investment.view',     label: 'Detalles' },
    { key: 'investment.view.detail_sheet', parent: 'investment.view',     label: 'Hoja de detalle' },
    { key: 'investment.crud.create',       parent: 'investment.crud',     label: 'Crear Inversión' },
    { key: 'investment.crud.edit',         parent: 'investment.crud',     label: 'Editar Inversión' },
    { key: 'investment.crud.delete',       parent: 'investment.crud',     label: 'Eliminar Inversión' },
    { key: 'investment.payments.add',      parent: 'investment.payments', label: 'Registrar Pago' },
    { key: 'investment.payments.history',  parent: 'investment.payments', label: 'Historial de Pagos' },
  ],
  defaults: {
    admin: {
      'investment.view':              ALL,
      'investment.view.list':         ALL,
      'investment.view.detail':       ALL,
      'investment.view.detail_sheet': ALL,
      'investment.crud':              ALL,
      'investment.crud.create':       ALL,
      'investment.crud.edit':         ALL,
      'investment.crud.delete':       ALL,
      'investment.payments':          ALL,
      'investment.payments.add':      ALL,
      'investment.payments.history':  ALL,
    },
    member: {
      'investment.view':              ALL,
      'investment.view.list':         READ,
      'investment.view.detail':       READ,
      'investment.view.detail_sheet': READ,
      'investment.crud':              ALL,
      'investment.crud.create':       ALL,
      'investment.crud.edit':         ALL,
      'investment.crud.delete':       ALL,
      'investment.payments':          ALL,
      'investment.payments.add':      ALL,
      'investment.payments.history':  READ,
    },
  },
};