export default {
  module: { key: 'module.Messages', label: 'Mensajes', order: 20 },
  sections: [
    { key: 'messages.view',   label: 'Ver Mensajes',    order: 1 },
    { key: 'messages.manage', label: 'Enviar Mensajes', order: 2 },
  ],
  actions: [
    { key: 'messages.view.inbox',   parent: 'messages.view',   label: 'Bandeja de entrada' },
    { key: 'messages.view.thread',  parent: 'messages.view',   label: 'Ver conversación' },

    { key: 'messages.manage.send',  parent: 'messages.manage', label: 'Enviar Mensaje' },
    { key: 'messages.manage.delete',parent: 'messages.manage', label: 'Eliminar Mensaje' },
  ],
  defaults: {
    admin: {
      'messages.view':          { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'messages.view.inbox':    { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'messages.view.thread':   { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'messages.manage':        { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'messages.manage.send':   { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'messages.manage.delete': { can_read: true, can_write: false, can_modify: false, can_delete: true,  can_view: true },
    },
    member: {
      'messages.view':          { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'messages.view.inbox':    { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'messages.view.thread':   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'messages.manage':        { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'messages.manage.send':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
      'messages.manage.delete': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    },
  },
};
