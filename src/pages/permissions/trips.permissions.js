export default {
  module: { key: 'module.Trips', label: 'Viajes', order: 23 },
  sections: [
    { key: 'trips.view',   label: 'Ver Viajes',      order: 1 },
    { key: 'trips.manage', label: 'Gestionar Viajes', order: 2 },
  ],
  actions: [
    { key: 'trips.view.list',       parent: 'trips.view',   label: 'Listar Viajes' },
    { key: 'trips.view.detail',     parent: 'trips.view',   label: 'Detalle de Viaje' },
    { key: 'trips.view.expenses',   parent: 'trips.view',   label: 'Ver Gastos del Viaje' },

    { key: 'trips.manage.create',   parent: 'trips.manage', label: 'Crear Viaje' },
    { key: 'trips.manage.edit',     parent: 'trips.manage', label: 'Editar Viaje' },
    { key: 'trips.manage.delete',   parent: 'trips.manage', label: 'Eliminar Viaje' },
    { key: 'trips.manage.close',    parent: 'trips.manage', label: 'Cerrar Viaje' },
  ],
  defaults: {
    admin: {
      'trips.view':          { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'trips.view.list':     { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'trips.view.detail':   { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'trips.view.expenses': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'trips.manage':        { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'trips.manage.create': { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'trips.manage.edit':   { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'trips.manage.delete': { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'trips.manage.close':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
    },
    member: {
      'trips.view':          { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'trips.view.list':     { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'trips.view.detail':   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'trips.view.expenses': { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'trips.manage':        { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'trips.manage.create': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'trips.manage.edit':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'trips.manage.delete': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'trips.manage.close':  { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
  },
};
