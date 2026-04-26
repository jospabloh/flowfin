export default {
  module: { key: 'module.MSI', label: 'MSI', order: 9 },
  sections: [
    { key: 'msi.view',          label: 'Ver MSI',              order: 1 },
    { key: 'msi.crud',          label: 'Gestionar MSI',        order: 2 },
    { key: 'msi.payments',      label: 'Pagos',                order: 3 },
    { key: 'msi.toggle_status', label: 'Cambiar Estado MSI',   order: 4 },
  ],
  actions: [
    { key: 'msi.view.list',         parent: 'msi.view',     label: 'Listar Compras MSI' },
    { key: 'msi.view.track',        parent: 'msi.view',     label: 'Seguimiento de Pagos' },
    // New keys (Paso 2)
    { key: 'msi.view.detail_sheet', parent: 'msi.view',     label: 'Hoja de detalle' },

    { key: 'msi.crud.create',       parent: 'msi.crud',     label: 'Registrar Compra MSI' },
    { key: 'msi.crud.edit',         parent: 'msi.crud',     label: 'Editar MSI' },
    { key: 'msi.crud.delete',       parent: 'msi.crud',     label: 'Eliminar MSI' },

    { key: 'msi.payments.record',   parent: 'msi.payments', label: 'Registrar Pago' },
    // New keys (Paso 2)
    { key: 'msi.payments.history',  parent: 'msi.payments', label: 'Historial de Pagos' },
    // Phase 3
    { key: 'msi.payments.edit',     parent: 'msi.payments',      label: 'Editar Pago' },
    { key: 'msi.payments.delete',   parent: 'msi.payments',      label: 'Eliminar Pago' },
    { key: 'msi.toggle_status.pause_resume', parent: 'msi.toggle_status', label: 'Pausar / Reactivar MSI' },
  ],
  defaults: {
    admin: {
      'msi.view':             { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.view.list':        { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'msi.view.track':       { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'msi.view.detail_sheet':{ can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'msi.crud':             { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.crud.create':      { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.crud.edit':        { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.crud.delete':      { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.payments':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.payments.record':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.payments.history': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'msi.payments.edit':    { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.payments.delete':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.toggle_status':               { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.toggle_status.pause_resume':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
    },
    member: {
      'msi.view':             { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.view.list':        { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'msi.view.track':       { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'msi.view.detail_sheet':{ can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'msi.crud':             { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.crud.create':      { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.crud.edit':        { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.crud.delete':      { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.payments':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.payments.record':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.payments.history': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'msi.payments.edit':    { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.payments.delete':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.toggle_status':               { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'msi.toggle_status.pause_resume':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
    },
  },
};
