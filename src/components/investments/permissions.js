export default {
  module: { key: 'module.Investments', label: 'Inversiones', order: 8 },
  sections: [
    { key: 'investment.view',     label: 'Ver Inversiones',      order: 1 },
    { key: 'investment.crud',     label: 'Gestionar Inversiones', order: 2 },
    { key: 'investment.payments', label: 'Pagos',                 order: 3 },
  ],
  actions: [
    { key: 'investment.view.list',         parent: 'investment.view',     label: 'Listar Inversiones' },
    { key: 'investment.view.detail',       parent: 'investment.view',     label: 'Detalles de Inversión' },
    // New keys (Paso 2)
    { key: 'investment.view.detail_sheet', parent: 'investment.view',     label: 'Hoja de detalle' },

    { key: 'investment.crud.create',       parent: 'investment.crud',     label: 'Crear Inversión' },
    { key: 'investment.crud.edit',         parent: 'investment.crud',     label: 'Editar Inversión' },
    { key: 'investment.crud.delete',       parent: 'investment.crud',     label: 'Eliminar Inversión' },

    { key: 'investment.payments.add',      parent: 'investment.payments', label: 'Registrar Pago' },
    // New keys (Paso 2)
    { key: 'investment.payments.history',  parent: 'investment.payments', label: 'Historial de Pagos' },
  ],
  defaults: {
    admin: {
      'investment.view':             { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'investment.view.list':        { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'investment.view.detail':      { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'investment.view.detail_sheet':{ can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'investment.crud':             { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'investment.crud.create':      { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'investment.crud.edit':        { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'investment.crud.delete':      { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'investment.payments':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'investment.payments.add':     { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'investment.payments.history': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    },
    member: {
      'investment.view':             { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'investment.view.list':        { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'investment.view.detail':      { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'investment.view.detail_sheet':{ can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'investment.crud':             { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'investment.crud.create':      { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'investment.crud.edit':        { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'investment.crud.delete':      { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'investment.payments':         { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'investment.payments.add':     { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'investment.payments.history': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
  },
};
