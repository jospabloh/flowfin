export default {
  module: { key: 'module.ScheduledPayments', label: 'Pagos del Mes', order: 7 },
  sections: [
    { key: 'scheduled.view',     label: 'Ver Pagos',    order: 1 },
    { key: 'scheduled.create',   label: 'Crear Pago',   order: 2 },
    { key: 'scheduled.mark',     label: 'Marcar Pago',  order: 3 },
    { key: 'scheduled.manage',   label: 'Gestionar',    order: 4 },
    { key: 'scheduled.payments', label: 'Pagos',        order: 5 },
  ],
  actions: [
    { key: 'scheduled.view.list',       parent: 'scheduled.view',   label: 'Listar Pagos Programados' },
    { key: 'scheduled.view.calendar',   parent: 'scheduled.view',   label: 'Vista Calendario' },

    { key: 'scheduled.create.form',     parent: 'scheduled.create', label: 'Nuevo Pago Programado' },

    { key: 'scheduled.mark.action',     parent: 'scheduled.mark',   label: 'Registrar como Pagado' },

    { key: 'scheduled.manage.edit',     parent: 'scheduled.manage',   label: 'Editar Pago' },
    { key: 'scheduled.manage.delete',   parent: 'scheduled.manage',   label: 'Eliminar Pago' },

    // Phase 3
    { key: 'scheduled.payments.unmark', parent: 'scheduled.payments', label: 'Desmarcar como Pagado' },
  ],
  defaults: {
    admin: {
      'scheduled.view':          { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'scheduled.view.list':     { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'scheduled.view.calendar': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'scheduled.create':        { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'scheduled.create.form':   { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'scheduled.mark':          { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'scheduled.mark.action':   { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'scheduled.manage':        { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'scheduled.manage.edit':   { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'scheduled.manage.delete': { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'scheduled.payments':              { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'scheduled.payments.unmark':       { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
    },
    member: {
      'scheduled.view':          { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'scheduled.view.list':     { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'scheduled.view.calendar': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'scheduled.create':        { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'scheduled.create.form':   { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'scheduled.mark':          { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'scheduled.mark.action':   { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'scheduled.manage':        { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'scheduled.manage.edit':   { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'scheduled.manage.delete': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'scheduled.payments':              { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'scheduled.payments.unmark':       { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true  },
    },
  },
};
