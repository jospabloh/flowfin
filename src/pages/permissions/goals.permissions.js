export default {
  module: { key: 'module.Goals', label: 'Metas', order: 12 },
  sections: [
    { key: 'goals.view',   label: 'Ver Metas',      order: 1 },
    { key: 'goals.manage', label: 'Gestionar Metas', order: 2 },
  ],
  actions: [
    { key: 'goals.view.list',       parent: 'goals.view',   label: 'Listar Metas' },
    { key: 'goals.view.detail',     parent: 'goals.view',   label: 'Detalle de Meta' },
    { key: 'goals.view.share_card', parent: 'goals.view',   label: 'Tarjeta para compartir' },

    { key: 'goals.manage.create',   parent: 'goals.manage', label: 'Crear Meta' },
    { key: 'goals.manage.edit',     parent: 'goals.manage', label: 'Editar Meta' },
    { key: 'goals.manage.delete',   parent: 'goals.manage', label: 'Eliminar Meta' },
  ],
  defaults: {
    admin: {
      'goals.view':           { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'goals.view.list':      { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'goals.view.detail':    { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'goals.view.share_card':{ can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'goals.manage':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'goals.manage.create':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'goals.manage.edit':    { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'goals.manage.delete':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
    },
    member: {
      'goals.view':           { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'goals.view.list':      { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'goals.view.detail':    { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'goals.view.share_card':{ can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'goals.manage':         { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'goals.manage.create':  { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'goals.manage.edit':    { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'goals.manage.delete':  { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
  },
};
