export default {
  module: { key: 'module.SupportTickets', label: 'Soporte', order: 21 },
  sections: [
    { key: 'support.view',   label: 'Ver Soporte',       order: 1 },
    { key: 'support.ticket', label: 'Gestionar Tickets',  order: 2 },
  ],
  actions: [
    { key: 'support.view.list',     parent: 'support.view',   label: 'Listar Tickets' },
    { key: 'support.view.thread',   parent: 'support.view',   label: 'Ver Conversación' },
    { key: 'support.ticket.create', parent: 'support.ticket', label: 'Abrir Ticket' },
    { key: 'support.ticket.reply',  parent: 'support.ticket', label: 'Responder' },
  ],
  defaults: {
    admin: {
      'support.view':           { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'support.view.list':      { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'support.view.thread':    { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'support.ticket':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'support.ticket.create':  { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
      'support.ticket.reply':   { can_read: true, can_write: true,  can_modify: false, can_delete: false, can_view: true },
    },
    member: {
      'support.view':           { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'support.view.list':      { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'support.view.thread':    { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
      'support.ticket':         { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'support.ticket.create':  { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  },
      'support.ticket.reply':   { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  },
    },
  },
};
