const ALL  = { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true };
const READ = { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true };
const NONE = { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false };

export default {
  module: { key: 'module.ScheduledPayments', label: 'Pagos del Mes', order: 7 },
  sections: [
    { key: 'scheduled.view',   label: 'Ver Pagos',    order: 1 },
    { key: 'scheduled.create', label: 'Crear Pago',   order: 2 },
    { key: 'scheduled.mark',   label: 'Marcar Pago',  order: 3 },
    { key: 'scheduled.manage', label: 'Gestionar',    order: 4 },
  ],
  actions: [
    { key: 'scheduled.view.list',     parent: 'scheduled.view',   label: 'Listar Pagos' },
    { key: 'scheduled.view.calendar', parent: 'scheduled.view',   label: 'Vista Calendario' },
    { key: 'scheduled.create.form',   parent: 'scheduled.create', label: 'Nuevo Pago Programado' },
    { key: 'scheduled.mark.action',   parent: 'scheduled.mark',   label: 'Registrar como Pagado' },
    { key: 'scheduled.manage.edit',   parent: 'scheduled.manage', label: 'Editar Pago' },
    { key: 'scheduled.manage.delete', parent: 'scheduled.manage', label: 'Eliminar Pago' },
  ],
  defaults: {
    admin: {
      'scheduled.view':          ALL,
      'scheduled.view.list':     ALL,
      'scheduled.view.calendar': ALL,
      'scheduled.create':        ALL,
      'scheduled.create.form':   ALL,
      'scheduled.mark':          ALL,
      'scheduled.mark.action':   ALL,
      'scheduled.manage':        ALL,
      'scheduled.manage.edit':   ALL,
      'scheduled.manage.delete': ALL,
    },
    member: {
      'scheduled.view':          ALL,
      'scheduled.view.list':     READ,
      'scheduled.view.calendar': READ,
      'scheduled.create':        NONE,
      'scheduled.create.form':   NONE,
      'scheduled.mark':          NONE,
      'scheduled.mark.action':   NONE,
      'scheduled.manage':        NONE,
      'scheduled.manage.edit':   NONE,
      'scheduled.manage.delete': NONE,
    },
  },
};