/**
 * PERMISSION REGISTRY v2 — Estructura jerárquica por MÓDULOS (hasta 5 niveles)
 *
 * Organización:
 * - Módulo (nivel 1): Dashboard, Transacciones, Reportes, etc.
 *   - Subsistema (nivel 2): ej. Transacciones > Crear, Transacciones > Ver
 *     - Sección (nivel 3): ej. Transacciones > Crear > Seleccionar Categoría
 *       - Acción (nivel 4-5): permisos granulares
 *
 * DEFAULT_MATRIX: mismo tipo de roles (admin, member) con igual granularidad.
 */

export const PERMISSION_REGISTRY = [
  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.Dashboard', kind: 'module', label: 'Inicio', order: 1 },
  { key: 'dashboard.view', kind: 'section', parent: 'module.Dashboard', label: 'Ver Dashboard', order: 1 },
  { key: 'dashboard.view.summary', kind: 'action', parent: 'dashboard.view', label: 'Resumen de Gastos' },
  { key: 'dashboard.view.upcoming', kind: 'action', parent: 'dashboard.view', label: 'Pagos Próximos' },
  { key: 'dashboard.view.analytics', kind: 'action', parent: 'dashboard.view', label: 'Análitica Básica' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: TRANSACCIONES
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.Transactions', kind: 'module', label: 'Movimientos', order: 2 },
  
  { key: 'transaction.view', kind: 'section', parent: 'module.Transactions', label: 'Ver Movimientos', order: 1 },
  { key: 'transaction.view.list', kind: 'action', parent: 'transaction.view', label: 'Listar Movimientos' },
  { key: 'transaction.view.filter', kind: 'action', parent: 'transaction.view', label: 'Filtrar y Buscar' },
  { key: 'transaction.view.export', kind: 'action', parent: 'transaction.view', label: 'Exportar a Excel' },

  { key: 'transaction.create', kind: 'section', parent: 'module.Transactions', label: 'Crear Movimiento', order: 2 },
  { key: 'transaction.create.manual', kind: 'action', parent: 'transaction.create', label: 'Entrada Manual' },
  { key: 'transaction.create.voice', kind: 'action', parent: 'transaction.create', label: 'Entrada por Voz' },
  { key: 'transaction.create.receipt', kind: 'action', parent: 'transaction.create', label: 'Escanear Ticket' },

  { key: 'transaction.edit', kind: 'section', parent: 'module.Transactions', label: 'Editar Movimiento', order: 3 },
  { key: 'transaction.edit.details', kind: 'action', parent: 'transaction.edit', label: 'Cambiar Detalles' },
  { key: 'transaction.edit.category', kind: 'action', parent: 'transaction.edit', label: 'Cambiar Categoría' },
  { key: 'transaction.edit.amount', kind: 'action', parent: 'transaction.edit', label: 'Cambiar Monto' },

  { key: 'transaction.delete', kind: 'section', parent: 'module.Transactions', label: 'Eliminar Movimiento', order: 4 },
  { key: 'transaction.delete.action', kind: 'action', parent: 'transaction.delete', label: 'Eliminar Registro' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: CAPTURA
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.Capture', kind: 'module', label: 'Registrar', order: 3 },
  { key: 'capture.form', kind: 'section', parent: 'module.Capture', label: 'Formulario de Captura', order: 1 },
  { key: 'capture.form.basic', kind: 'action', parent: 'capture.form', label: 'Campos Básicos' },
  { key: 'capture.form.advanced', kind: 'action', parent: 'capture.form', label: 'Opciones Avanzadas' },
  { key: 'capture.ai_assist', kind: 'section', parent: 'module.Capture', label: 'Asistencia IA', order: 2 },
  { key: 'capture.ai_assist.suggestions', kind: 'action', parent: 'capture.ai_assist', label: 'Sugerencias Automáticas' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: REPORTES
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.Reports', kind: 'module', label: 'Reportes', order: 4 },
  { key: 'reports.view', kind: 'section', parent: 'module.Reports', label: 'Ver Reportes', order: 1 },
  { key: 'reports.view.charts', kind: 'action', parent: 'reports.view', label: 'Gráficos' },
  { key: 'reports.view.breakdown', kind: 'action', parent: 'reports.view', label: 'Desglose por Categoría' },
  { key: 'reports.view.trends', kind: 'action', parent: 'reports.view', label: 'Tendencias' },
  { key: 'reports.export', kind: 'section', parent: 'module.Reports', label: 'Exportar Reportes', order: 2 },
  { key: 'reports.export.pdf', kind: 'action', parent: 'reports.export', label: 'Descargar PDF' },
  { key: 'reports.export.image', kind: 'action', parent: 'reports.export', label: 'Descargar Imagen' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: ASISTENTE IA
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.Assistant', kind: 'module', label: 'Asistente IA', order: 5 },
  { key: 'assistant.chat', kind: 'section', parent: 'module.Assistant', label: 'Chat', order: 1 },
  { key: 'assistant.chat.send', kind: 'action', parent: 'assistant.chat', label: 'Enviar Mensajes' },
  { key: 'assistant.chat.voice', kind: 'action', parent: 'assistant.chat', label: 'Entrada de Voz' },
  { key: 'assistant.features', kind: 'section', parent: 'module.Assistant', label: 'Características', order: 2 },
  { key: 'assistant.features.receipt', kind: 'action', parent: 'assistant.features', label: 'Escanear Tickets' },
  { key: 'assistant.features.register', kind: 'action', parent: 'assistant.features', label: 'Registrar Movimientos' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: PRESUPUESTO
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.Budget', kind: 'module', label: 'Presupuesto', order: 6 },
  { key: 'budget.view', kind: 'section', parent: 'module.Budget', label: 'Ver Presupuesto', order: 1 },
  { key: 'budget.view.recommendations', kind: 'action', parent: 'budget.view', label: 'Recomendaciones' },
  { key: 'budget.view.health', kind: 'action', parent: 'budget.view', label: 'Salud Financiera' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: PAGOS PROGRAMADOS
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.ScheduledPayments', kind: 'module', label: 'Pagos del Mes', order: 7 },
  { key: 'scheduled.view', kind: 'section', parent: 'module.ScheduledPayments', label: 'Ver Pagos', order: 1 },
  { key: 'scheduled.view.list', kind: 'action', parent: 'scheduled.view', label: 'Listar Pagos Programados' },
  { key: 'scheduled.view.calendar', kind: 'action', parent: 'scheduled.view', label: 'Vista Calendario' },
  
  { key: 'scheduled.create', kind: 'section', parent: 'module.ScheduledPayments', label: 'Crear Pago', order: 2 },
  { key: 'scheduled.create.form', kind: 'action', parent: 'scheduled.create', label: 'Nuevo Pago Programado' },

  { key: 'scheduled.mark', kind: 'section', parent: 'module.ScheduledPayments', label: 'Marcar Pago', order: 3 },
  { key: 'scheduled.mark.action', kind: 'action', parent: 'scheduled.mark', label: 'Registrar como Pagado' },

  { key: 'scheduled.manage', kind: 'section', parent: 'module.ScheduledPayments', label: 'Gestionar', order: 4 },
  { key: 'scheduled.manage.edit', kind: 'action', parent: 'scheduled.manage', label: 'Editar Pago' },
  { key: 'scheduled.manage.delete', kind: 'action', parent: 'scheduled.manage', label: 'Eliminar Pago' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: INVERSIONES
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.Investments', kind: 'module', label: 'Inversiones', order: 8 },
  { key: 'investment.view', kind: 'section', parent: 'module.Investments', label: 'Ver Inversiones', order: 1 },
  { key: 'investment.view.list', kind: 'action', parent: 'investment.view', label: 'Listar Inversiones' },
  { key: 'investment.view.detail', kind: 'action', parent: 'investment.view', label: 'Detalles de Inversión' },

  { key: 'investment.crud', kind: 'section', parent: 'module.Investments', label: 'Gestionar Inversiones', order: 2 },
  { key: 'investment.crud.create', kind: 'action', parent: 'investment.crud', label: 'Crear Inversión' },
  { key: 'investment.crud.edit', kind: 'action', parent: 'investment.crud', label: 'Editar Inversión' },
  { key: 'investment.crud.delete', kind: 'action', parent: 'investment.crud', label: 'Eliminar Inversión' },

  { key: 'investment.payments', kind: 'section', parent: 'module.Investments', label: 'Pagos', order: 3 },
  { key: 'investment.payments.add', kind: 'action', parent: 'investment.payments', label: 'Registrar Pago' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: MSI (MENSUALIDADES)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.MSI', kind: 'module', label: 'MSI', order: 9 },
  { key: 'msi.view', kind: 'section', parent: 'module.MSI', label: 'Ver MSI', order: 1 },
  { key: 'msi.view.list', kind: 'action', parent: 'msi.view', label: 'Listar Compras MSI' },
  { key: 'msi.view.track', kind: 'action', parent: 'msi.view', label: 'Seguimiento de Pagos' },

  { key: 'msi.crud', kind: 'section', parent: 'module.MSI', label: 'Gestionar MSI', order: 2 },
  { key: 'msi.crud.create', kind: 'action', parent: 'msi.crud', label: 'Registrar Compra MSI' },
  { key: 'msi.crud.edit', kind: 'action', parent: 'msi.crud', label: 'Editar MSI' },
  { key: 'msi.crud.delete', kind: 'action', parent: 'msi.crud', label: 'Eliminar MSI' },

  { key: 'msi.payments', kind: 'section', parent: 'module.MSI', label: 'Pagos', order: 3 },
  { key: 'msi.payments.record', kind: 'action', parent: 'msi.payments', label: 'Registrar Pago' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: RENTAS
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.Rentals', kind: 'module', label: 'Rentas', order: 10 },
  { key: 'rental.view', kind: 'section', parent: 'module.Rentals', label: 'Ver Propiedades', order: 1 },
  { key: 'rental.view.list', kind: 'action', parent: 'rental.view', label: 'Listar Propiedades' },
  { key: 'rental.view.detail', kind: 'action', parent: 'rental.view', label: 'Detalles de Propiedad' },

  { key: 'rental.property', kind: 'section', parent: 'module.Rentals', label: 'Gestionar Propiedades', order: 2 },
  { key: 'rental.property.create', kind: 'action', parent: 'rental.property', label: 'Registrar Propiedad' },
  { key: 'rental.property.edit', kind: 'action', parent: 'rental.property', label: 'Editar Propiedad' },
  { key: 'rental.property.delete', kind: 'action', parent: 'rental.property', label: 'Eliminar Propiedad' },

  { key: 'rental.payments', kind: 'section', parent: 'module.Rentals', label: 'Pagos de Renta', order: 3 },
  { key: 'rental.payments.record', kind: 'action', parent: 'rental.payments', label: 'Registrar Pago' },
  { key: 'rental.payments.reverse', kind: 'action', parent: 'rental.payments', label: 'Revertir Pago' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: CATÁLOGOS
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.Catalogs', kind: 'module', label: 'Catálogos', order: 11 },
  
  { key: 'catalog.categories', kind: 'section', parent: 'module.Catalogs', label: 'Rubros', order: 1 },
  { key: 'catalog.categories.view', kind: 'action', parent: 'catalog.categories', label: 'Ver Rubros' },
  { key: 'catalog.categories.create', kind: 'action', parent: 'catalog.categories', label: 'Crear Rubro' },
  { key: 'catalog.categories.edit', kind: 'action', parent: 'catalog.categories', label: 'Editar Rubro' },
  { key: 'catalog.categories.delete', kind: 'action', parent: 'catalog.categories', label: 'Eliminar Rubro' },

  { key: 'catalog.subcategories', kind: 'section', parent: 'module.Catalogs', label: 'SubRubros', order: 2 },
  { key: 'catalog.subcategories.view', kind: 'action', parent: 'catalog.subcategories', label: 'Ver SubRubros' },
  { key: 'catalog.subcategories.create', kind: 'action', parent: 'catalog.subcategories', label: 'Crear SubRubro' },
  { key: 'catalog.subcategories.edit', kind: 'action', parent: 'catalog.subcategories', label: 'Editar SubRubro' },
  { key: 'catalog.subcategories.delete', kind: 'action', parent: 'catalog.subcategories', label: 'Eliminar SubRubro' },

  { key: 'catalog.persons', kind: 'section', parent: 'module.Catalogs', label: 'Personas', order: 3 },
  { key: 'catalog.persons.view', kind: 'action', parent: 'catalog.persons', label: 'Ver Personas' },
  { key: 'catalog.persons.create', kind: 'action', parent: 'catalog.persons', label: 'Crear Persona' },
  { key: 'catalog.persons.edit', kind: 'action', parent: 'catalog.persons', label: 'Editar Persona' },
  { key: 'catalog.persons.delete', kind: 'action', parent: 'catalog.persons', label: 'Eliminar Persona' },

  { key: 'catalog.methods', kind: 'section', parent: 'module.Catalogs', label: 'Formas de Pago', order: 4 },
  { key: 'catalog.methods.view', kind: 'action', parent: 'catalog.methods', label: 'Ver Formas' },
  { key: 'catalog.methods.create', kind: 'action', parent: 'catalog.methods', label: 'Crear Forma' },
  { key: 'catalog.methods.edit', kind: 'action', parent: 'catalog.methods', label: 'Editar Forma' },
  { key: 'catalog.methods.delete', kind: 'action', parent: 'catalog.methods', label: 'Eliminar Forma' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: CONFIGURACIÓN DE FAMILIA
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.FamilySettings', kind: 'module', label: 'Mi Familia', order: 12 },
  { key: 'family.settings', kind: 'section', parent: 'module.FamilySettings', label: 'Configuración', order: 1 },
  { key: 'family.settings.basic', kind: 'action', parent: 'family.settings', label: 'Datos Básicos' },
  { key: 'family.settings.locale', kind: 'action', parent: 'family.settings', label: 'Idioma y Moneda' },
  { key: 'family.settings.advanced', kind: 'action', parent: 'family.settings', label: 'Opciones Avanzadas' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: CONFIGURACIÓN DE CUENTA
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.AccountSettings', kind: 'module', label: 'Mi Cuenta', order: 13 },
  { key: 'account.profile', kind: 'section', parent: 'module.AccountSettings', label: 'Perfil', order: 1 },
  { key: 'account.profile.view', kind: 'action', parent: 'account.profile', label: 'Ver Información' },
  { key: 'account.profile.edit', kind: 'action', parent: 'account.profile', label: 'Editar Perfil' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: ADMINISTRACIÓN DE FAMILIA
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.FamilyAdmin', kind: 'module', label: 'Admin Familia', order: 14 },
  { key: 'family.admin.members', kind: 'section', parent: 'module.FamilyAdmin', label: 'Miembros', order: 1 },
  { key: 'family.admin.members.view', kind: 'action', parent: 'family.admin.members', label: 'Ver Miembros' },
  { key: 'family.admin.members.invite', kind: 'action', parent: 'family.admin.members', label: 'Invitar Miembro' },
  { key: 'family.admin.members.approve', kind: 'action', parent: 'family.admin.members', label: 'Aprobar Solicitudes' },
  { key: 'family.admin.members.remove', kind: 'action', parent: 'family.admin.members', label: 'Eliminar Miembro' },

  { key: 'family.admin.billing', kind: 'section', parent: 'module.FamilyAdmin', label: 'Facturación', order: 2 },
  { key: 'family.admin.billing.view', kind: 'action', parent: 'family.admin.billing', label: 'Ver Estado' },
  { key: 'family.admin.billing.upgrade', kind: 'action', parent: 'family.admin.billing', label: 'Mejorar Plan' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: PERMISOS (ADMIN ONLY)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.PermissionAdmin', kind: 'module', label: 'Permisos', order: 15 },
  { key: 'permission.manage', kind: 'section', parent: 'module.PermissionAdmin', label: 'Gestionar Permisos', order: 1 },
  { key: 'permission.manage.view', kind: 'action', parent: 'permission.manage', label: 'Ver Matriz' },
  { key: 'permission.manage.edit', kind: 'action', parent: 'permission.manage', label: 'Editar Permisos' },
  { key: 'permission.manage.reset', kind: 'action', parent: 'permission.manage', label: 'Restablecer Valores' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: LICENCIAS (PLATFORM ADMIN ONLY)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.LicenseAdmin', kind: 'module', label: 'Mi Licencia', order: 16 },
  { key: 'license.manage', kind: 'section', parent: 'module.LicenseAdmin', label: 'Gestionar Licencia', order: 1 },
  { key: 'license.manage.view', kind: 'action', parent: 'license.manage', label: 'Ver Licencia' },
  { key: 'license.manage.activate', kind: 'action', parent: 'license.manage', label: 'Activar Licencia' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: USO DE IA (PLATFORM ADMIN ONLY)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.AIUsage', kind: 'module', label: 'Uso de IA', order: 17 },
  { key: 'ai.usage', kind: 'section', parent: 'module.AIUsage', label: 'Ver Uso', order: 1 },
  { key: 'ai.usage.view', kind: 'action', parent: 'ai.usage', label: 'Historial de Consumo' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO: DOCUMENTACIÓN
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'module.UserManual', kind: 'module', label: 'Manual', order: 18 },
  { key: 'docs.manual', kind: 'section', parent: 'module.UserManual', label: 'Ver Manual', order: 1 },
  { key: 'docs.manual.view', kind: 'action', parent: 'docs.manual', label: 'Acceder Documentación' },

  { key: 'module.About', kind: 'module', label: 'Acerca de', order: 19 },
  { key: 'docs.about', kind: 'section', parent: 'module.About', label: 'Ver Información', order: 1 },
  { key: 'docs.about.view', kind: 'action', parent: 'docs.about', label: 'Acceder Información' },
];

// Columnas de permisos disponibles
export const PERMISSION_COLUMNS = [
  { key: 'can_read',   label: 'Leer',      description: 'Puede ver/leer' },
  { key: 'can_write',  label: 'Crear',     description: 'Puede crear' },
  { key: 'can_modify', label: 'Modificar', description: 'Puede editar' },
  { key: 'can_delete', label: 'Eliminar',  description: 'Puede borrar' },
  { key: 'can_view',   label: 'Visible',   description: 'Visible en navegación' },
];

/**
 * DEFAULT_MATRIX v2 — misma granularidad que PERMISSION_REGISTRY
 *
 * Estructura: por rol (admin, member) → por módulo → por sección → por acción
 */
export const DEFAULT_MATRIX = {
  admin: {
    // DASHBOARD
    'dashboard.view': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'dashboard.view.summary': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'dashboard.view.upcoming': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'dashboard.view.analytics': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },

    // TRANSACCIONES
    'transaction.view': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'transaction.view.list': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'transaction.view.filter': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'transaction.view.export': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'transaction.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'transaction.create.manual': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'transaction.create.voice': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'transaction.create.receipt': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'transaction.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'transaction.edit.details': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'transaction.edit.category': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'transaction.edit.amount': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'transaction.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'transaction.delete.action': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // CAPTURA
    'capture.form': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'capture.form.basic': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'capture.form.advanced': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'capture.ai_assist': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'capture.ai_assist.suggestions': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },

    // REPORTES
    'reports.view': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'reports.view.charts': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'reports.view.breakdown': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'reports.view.trends': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'reports.export': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'reports.export.pdf': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'reports.export.image': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },

    // ASISTENTE IA
    'assistant.chat': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'assistant.chat.send': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'assistant.chat.voice': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'assistant.features': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'assistant.features.receipt': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'assistant.features.register': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },

    // PRESUPUESTO
    'budget.view': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'budget.view.recommendations': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'budget.view.health': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },

    // PAGOS PROGRAMADOS
    'scheduled.view': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'scheduled.view.list': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'scheduled.view.calendar': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'scheduled.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'scheduled.create.form': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'scheduled.mark': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'scheduled.mark.action': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'scheduled.manage': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'scheduled.manage.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'scheduled.manage.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // INVERSIONES
    'investment.view': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'investment.view.list': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'investment.view.detail': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'investment.crud': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'investment.crud.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'investment.crud.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'investment.crud.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'investment.payments': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'investment.payments.add': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // MSI
    'msi.view': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'msi.view.list': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'msi.view.track': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'msi.crud': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'msi.crud.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'msi.crud.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'msi.crud.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'msi.payments': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'msi.payments.record': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // RENTAS
    'rental.view': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.view.list': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'rental.view.detail': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'rental.property': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.property.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.property.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.property.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.payments': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.payments.record': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.payments.reverse': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // CATÁLOGOS
    'catalog.categories': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.categories.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'catalog.categories.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.categories.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.categories.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.subcategories': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.subcategories.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'catalog.subcategories.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.subcategories.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.subcategories.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.persons': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.persons.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'catalog.persons.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.persons.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.persons.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.methods': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.methods.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'catalog.methods.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.methods.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.methods.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // CONFIGURACIÓN DE FAMILIA
    'family.settings': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'family.settings.basic': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'family.settings.locale': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'family.settings.advanced': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // CONFIGURACIÓN DE CUENTA
    'account.profile': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'account.profile.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'account.profile.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // ADMINISTRACIÓN
    'family.admin.members': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'family.admin.members.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'family.admin.members.invite': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'family.admin.members.approve': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'family.admin.members.remove': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'family.admin.billing': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'family.admin.billing.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'family.admin.billing.upgrade': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // PERMISOS
    'permission.manage': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'permission.manage.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'permission.manage.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'permission.manage.reset': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // LICENCIAS (hidden for family admins)
    'license.manage': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'license.manage.view': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'license.manage.activate': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },

    // USO DE IA (hidden for family admins)
    'ai.usage': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'ai.usage.view': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },

    // DOCUMENTACIÓN
    'docs.manual': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'docs.manual.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'docs.about': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'docs.about.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
  },

  member: {
    // DASHBOARD
    'dashboard.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'dashboard.view.summary': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'dashboard.view.upcoming': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'dashboard.view.analytics': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },

    // TRANSACCIONES
    'transaction.view': { can_read: true, can_write: true, can_modify: true, can_delete: false, can_view: true },
    'transaction.view.list': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'transaction.view.filter': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'transaction.view.export': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'transaction.create': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'transaction.create.manual': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'transaction.create.voice': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'transaction.create.receipt': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'transaction.edit': { can_read: true, can_write: false, can_modify: true, can_delete: false, can_view: true },
    'transaction.edit.details': { can_read: true, can_write: false, can_modify: true, can_delete: false, can_view: true },
    'transaction.edit.category': { can_read: true, can_write: false, can_modify: true, can_delete: false, can_view: true },
    'transaction.edit.amount': { can_read: true, can_write: false, can_modify: true, can_delete: false, can_view: true },
    'transaction.delete': { can_read: true, can_write: false, can_modify: false, can_delete: true, can_view: true },
    'transaction.delete.action': { can_read: true, can_write: false, can_modify: false, can_delete: true, can_view: true },

    // CAPTURA
    'capture.form': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'capture.form.basic': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'capture.form.advanced': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'capture.ai_assist': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'capture.ai_assist.suggestions': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },

    // REPORTES
    'reports.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'reports.view.charts': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'reports.view.breakdown': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'reports.view.trends': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'reports.export': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'reports.export.pdf': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'reports.export.image': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },

    // ASISTENTE IA
    'assistant.chat': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'assistant.chat.send': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'assistant.chat.voice': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'assistant.features': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'assistant.features.receipt': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },
    'assistant.features.register': { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true },

    // PRESUPUESTO
    'budget.view': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'budget.view.recommendations': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'budget.view.health': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },

    // PAGOS PROGRAMADOS (member: view only)
    'scheduled.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'scheduled.view.list': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'scheduled.view.calendar': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'scheduled.create': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'scheduled.create.form': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'scheduled.mark': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'scheduled.mark.action': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'scheduled.manage': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'scheduled.manage.edit': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'scheduled.manage.delete': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },

    // INVERSIONES
    'investment.view': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'investment.view.list': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'investment.view.detail': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'investment.crud': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'investment.crud.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'investment.crud.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'investment.crud.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'investment.payments': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'investment.payments.add': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // MSI
    'msi.view': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'msi.view.list': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'msi.view.track': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'msi.crud': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'msi.crud.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'msi.crud.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'msi.crud.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'msi.payments': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'msi.payments.record': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // RENTAS
    'rental.view': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.view.list': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'rental.view.detail': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'rental.property': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.property.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.property.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.property.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.payments': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.payments.record': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'rental.payments.reverse': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // CATÁLOGOS (member: read + basic manage)
    'catalog.categories': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.categories.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'catalog.categories.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.categories.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.categories.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.subcategories': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.subcategories.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'catalog.subcategories.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.subcategories.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.subcategories.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.persons': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.persons.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'catalog.persons.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.persons.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.persons.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.methods': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.methods.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'catalog.methods.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.methods.edit': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'catalog.methods.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },

    // CONFIGURACIÓN DE FAMILIA (member: no acceso)
    'family.settings': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'family.settings.basic': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'family.settings.locale': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'family.settings.advanced': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },

    // CONFIGURACIÓN DE CUENTA
    'account.profile': { can_read: true, can_write: true, can_modify: true, can_delete: false, can_view: true },
    'account.profile.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'account.profile.edit': { can_read: true, can_write: true, can_modify: true, can_delete: false, can_view: true },

    // ADMINISTRACIÓN (member: no acceso)
    'family.admin.members': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'family.admin.members.view': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'family.admin.members.invite': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'family.admin.members.approve': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'family.admin.members.remove': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'family.admin.billing': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'family.admin.billing.view': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'family.admin.billing.upgrade': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },

    // PERMISOS (member: no acceso)
    'permission.manage': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'permission.manage.view': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'permission.manage.edit': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'permission.manage.reset': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },

    // LICENCIAS (member: no acceso)
    'license.manage': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'license.manage.view': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'license.manage.activate': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },

    // USO DE IA (member: no acceso)
    'ai.usage': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'ai.usage.view': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },

    // DOCUMENTACIÓN
    'docs.manual': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'docs.manual.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'docs.about': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
    'docs.about.view': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true },
  },
};

// Fallback para permisos no definidos explícitamente
const OPEN_PERMISSION = { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true };
const CLOSED_PERMISSION = { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false };

export function getDefaultPermission(role, permissionKey) {
  return DEFAULT_MATRIX[role]?.[permissionKey] ?? (role === 'admin' ? OPEN_PERMISSION : CLOSED_PERMISSION);
}