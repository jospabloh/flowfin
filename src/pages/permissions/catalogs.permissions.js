export default {
  module: { key: 'module.Catalogs', label: 'Catálogos', order: 11 },
  sections: [
    { key: 'catalog.categories',        label: 'Rubros',                   order: 1 },
    { key: 'catalog.subcategories',     label: 'SubRubros',                order: 2 },
    { key: 'catalog.persons',           label: 'Personas',                 order: 3 },
    { key: 'catalog.methods',           label: 'Formas de Pago',           order: 4 },
    { key: 'catalog.required_types',    label: 'Tipos de Gasto',           order: 5 },
    { key: 'catalog.transfer_destinations', label: 'Destinos de Transferencia', order: 6 },
  ],
  actions: [
    { key: 'catalog.categories.view',         parent: 'catalog.categories',    label: 'Ver Rubros' },
    { key: 'catalog.categories.create',       parent: 'catalog.categories',    label: 'Crear Rubro' },
    { key: 'catalog.categories.edit',         parent: 'catalog.categories',    label: 'Editar Rubro' },
    { key: 'catalog.categories.delete',       parent: 'catalog.categories',    label: 'Eliminar Rubro' },

    { key: 'catalog.subcategories.view',      parent: 'catalog.subcategories', label: 'Ver SubRubros' },
    { key: 'catalog.subcategories.create',    parent: 'catalog.subcategories', label: 'Crear SubRubro' },
    { key: 'catalog.subcategories.edit',      parent: 'catalog.subcategories', label: 'Editar SubRubro' },
    { key: 'catalog.subcategories.delete',    parent: 'catalog.subcategories', label: 'Eliminar SubRubro' },

    { key: 'catalog.persons.view',            parent: 'catalog.persons',       label: 'Ver Personas' },
    { key: 'catalog.persons.create',          parent: 'catalog.persons',       label: 'Crear Persona' },
    { key: 'catalog.persons.edit',            parent: 'catalog.persons',       label: 'Editar Persona' },
    { key: 'catalog.persons.delete',          parent: 'catalog.persons',       label: 'Eliminar Persona' },

    { key: 'catalog.methods.view',            parent: 'catalog.methods',       label: 'Ver Formas' },
    { key: 'catalog.methods.create',          parent: 'catalog.methods',       label: 'Crear Forma' },
    { key: 'catalog.methods.edit',            parent: 'catalog.methods',       label: 'Editar Forma' },
    { key: 'catalog.methods.delete',          parent: 'catalog.methods',       label: 'Eliminar Forma' },

    { key: 'catalog.required_types.view',     parent: 'catalog.required_types',         label: 'Ver Tipos de Gasto' },
    { key: 'catalog.required_types.edit',     parent: 'catalog.required_types',         label: 'Editar Tipos de Gasto' },

    { key: 'catalog.transfer_destinations.view', parent: 'catalog.transfer_destinations', label: 'Ver Destinos de Transferencia' },
    { key: 'catalog.transfer_destinations.edit', parent: 'catalog.transfer_destinations', label: 'Editar Destinos de Transferencia' },
  ],
  defaults: {
    admin: {
      'catalog.categories':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.categories.view':    { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'catalog.categories.create':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.categories.edit':    { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.categories.delete':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },

      'catalog.subcategories':        { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.subcategories.view':   { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'catalog.subcategories.create': { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.subcategories.edit':   { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.subcategories.delete': { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },

      'catalog.persons':              { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.persons.view':         { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'catalog.persons.create':       { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.persons.edit':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.persons.delete':       { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },

      'catalog.methods':              { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.methods.view':         { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'catalog.methods.create':       { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.methods.edit':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.methods.delete':       { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },

      'catalog.required_types':              { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.required_types.view':         { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'catalog.required_types.edit':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },

      'catalog.transfer_destinations':       { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.transfer_destinations.view':  { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'catalog.transfer_destinations.edit':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
    },
    member: {
      'catalog.categories':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.categories.view':    { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'catalog.categories.create':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.categories.edit':    { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.categories.delete':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },

      'catalog.subcategories':        { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.subcategories.view':   { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'catalog.subcategories.create': { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.subcategories.edit':   { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.subcategories.delete': { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },

      'catalog.persons':              { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.persons.view':         { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'catalog.persons.create':       { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.persons.edit':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.persons.delete':       { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },

      'catalog.methods':              { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.methods.view':         { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'catalog.methods.create':       { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.methods.edit':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.methods.delete':       { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },

      'catalog.required_types':              { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.required_types.view':         { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'catalog.required_types.edit':         { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },

      'catalog.transfer_destinations':       { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
      'catalog.transfer_destinations.view':  { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
      'catalog.transfer_destinations.edit':  { can_read: true, can_write: true,  can_modify: true,  can_delete: true,  can_view: true },
    },
  },
};
