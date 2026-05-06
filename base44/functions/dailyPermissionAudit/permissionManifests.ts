// Auto-generated snapshot of all permission manifest defaults.
// Update this file when manifests in src/pages/permissions/ or src/components/**/permissions.js change.
// Last synced: 2026-05-06

type Perms = {
  can_read: boolean;
  can_write: boolean;
  can_modify: boolean;
  can_delete: boolean;
  can_view: boolean;
};

export type PermEntry = {
  key: string;
  label: string;
  admin: Perms;
  member: Perms;
};

const T: Perms = { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  };
const Ro: Perms = { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  };
const Closed: Perms = { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false };

function p(key: string, label: string, admin: Perms, member: Perms): PermEntry {
  return { key, label, admin, member };
}

// ── module.Dashboard (order 1) ────────────────────────────────────────────────
const DASHBOARD: PermEntry[] = [
  p('dashboard.view',           'Ver Dashboard',             T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  }),
  p('dashboard.view.summary',   'Resumen de Gastos',         Ro,  Ro),
  p('dashboard.view.upcoming',  'Pagos Próximos',            Ro,  Ro),
  p('dashboard.view.analytics', 'Analítica Básica',          Ro,  Ro),
  p('dashboard.view.recent',    'Movimientos recientes',     Ro,  Ro),
  p('dashboard.view.alerts',    'Alertas y banners',         Ro,  Ro),
  p('dashboard.view.filters',   'Filtros del dashboard',     Ro,  Ro),
];

// ── module.Transactions (order 2) ─────────────────────────────────────────────
const TRANSACTIONS: PermEntry[] = [
  p('transaction.view',                'Ver Movimientos',          T,   { can_read: true,  can_write: true,  can_modify: true,  can_delete: false, can_view: true  }),
  p('transaction.view.list',           'Listar Movimientos',       Ro,  Ro),
  p('transaction.view.filter',         'Filtrar y Buscar',         Ro,  Ro),
  p('transaction.view.export',         'Exportar a Excel',         Ro,  Ro),
  p('transaction.view.search',         'Búsqueda',                 Ro,  Ro),
  p('transaction.view.pending_banner', 'Banner de pendientes',     Ro,  Ro),
  p('transaction.create',              'Crear Movimiento',         T,   { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  }),
  p('transaction.create.manual',       'Entrada Manual',           T,   { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  }),
  p('transaction.create.voice',        'Entrada por Voz',          T,   { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  }),
  p('transaction.create.receipt',      'Escanear Ticket',          T,   { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  }),
  p('transaction.edit',                'Editar Movimiento',        T,   { can_read: true,  can_write: false, can_modify: true,  can_delete: false, can_view: true  }),
  p('transaction.edit.details',        'Cambiar Detalles',         T,   { can_read: true,  can_write: false, can_modify: true,  can_delete: false, can_view: true  }),
  p('transaction.edit.category',       'Cambiar Categoría',        T,   { can_read: true,  can_write: false, can_modify: true,  can_delete: false, can_view: true  }),
  p('transaction.edit.amount',         'Cambiar Monto',            T,   { can_read: true,  can_write: false, can_modify: true,  can_delete: false, can_view: true  }),
  p('transaction.delete',              'Eliminar Movimiento',      T,   { can_read: true,  can_write: false, can_modify: false, can_delete: true,  can_view: true  }),
  p('transaction.delete.action',       'Eliminar Registro',        T,   { can_read: true,  can_write: false, can_modify: false, can_delete: true,  can_view: true  }),
];

// ── module.Capture (order 3) ──────────────────────────────────────────────────
const CAPTURE: PermEntry[] = [
  p('capture.form',                  'Formulario de Captura',    T,   { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  }),
  p('capture.form.basic',            'Campos Básicos',           T,   { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  }),
  p('capture.form.advanced',         'Opciones Avanzadas',       T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: false }),
  p('capture.ai_assist',             'Asistencia IA',            T,   { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  }),
  p('capture.ai_assist.suggestions', 'Sugerencias Automáticas',  Ro,  Ro),
];

// ── module.Reports (order 4) ──────────────────────────────────────────────────
const REPORTS: PermEntry[] = [
  p('reports.view',              'Ver Reportes',                T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  }),
  p('reports.view.charts',       'Gráficos',                    Ro,  Ro),
  p('reports.view.breakdown',    'Desglose por Categoría',      Ro,  Ro),
  p('reports.view.trends',       'Tendencias',                  Ro,  Ro),
  p('reports.view.by_category',  'Por Categoría',               Ro,  Ro),
  p('reports.view.by_person',    'Por Persona',                 Ro,  Ro),
  p('reports.view.by_method',    'Por Método de Pago',          Ro,  Ro),
  p('reports.view.monthly',      'Mensual',                     Ro,  Ro),
  p('reports.view.comparative',  'Comparativa',                 Ro,  Ro),
  p('reports.view.detail',       'Detalle / Drill-down',        Ro,  Ro),
  p('reports.view.filter',       'Filtros y rango de fechas',   Ro,  Ro),
  p('reports.export',            'Exportar Reportes',           T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  }),
  p('reports.export.pdf',        'Descargar PDF',               Ro,  Ro),
  p('reports.export.image',      'Descargar Imagen',            Ro,  Ro),
  p('reports.export.share',      'Compartir',                   Ro,  { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: false }),
];

// ── module.Assistant (order 5) ────────────────────────────────────────────────
const ASSISTANT: PermEntry[] = [
  p('assistant.chat',                        'Chat',                  T,   { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  }),
  p('assistant.chat.send',                   'Enviar Mensajes',       { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true }, { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true }),
  p('assistant.chat.voice',                  'Entrada de Voz',        { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true }, { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true }),
  p('assistant.chat.clear',                  'Limpiar conversación',  { can_read: true, can_write: true, can_modify: false, can_delete: true,  can_view: true }, { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: true }),
  p('assistant.features',                    'Características',       T,   { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  }),
  p('assistant.features.receipt',            'Escanear Tickets',      { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true }, { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true }),
  p('assistant.features.register',           'Registrar Movimientos', { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true }, { can_read: true, can_write: true, can_modify: false, can_delete: false, can_view: true }),
  p('assistant.features.predictive_chips',   'Chips predictivos',     Ro,  Ro),
];

// ── module.Budget (order 6) ───────────────────────────────────────────────────
const BUDGET: PermEntry[] = [
  p('budget.view',                'Ver Presupuesto',         T,   T),
  p('budget.view.recommendations','Recomendaciones',         Ro,  Ro),
  p('budget.view.health',         'Salud Financiera',        Ro,  Ro),
  p('budget.view.cards',          'Tarjetas de resumen',     Ro,  Ro),
  p('budget.view.chart',          'Gráfico de barras',       Ro,  Ro),
  p('budget.view.period_selector','Selector de periodo',     Ro,  Ro),
];

// ── module.ScheduledPayments (order 7) ────────────────────────────────────────
const SCHEDULED: PermEntry[] = [
  p('scheduled.view',           'Ver Pagos',                   T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  }),
  p('scheduled.view.list',      'Listar Pagos Programados',    Ro,  Ro),
  p('scheduled.view.calendar',  'Vista Calendario',            Ro,  Ro),
  p('scheduled.create',         'Crear Pago',                  T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: false }),
  p('scheduled.create.form',    'Nuevo Pago Programado',       T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: false }),
  p('scheduled.mark',           'Marcar Pago',                 T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: false }),
  p('scheduled.mark.action',    'Registrar como Pagado',       T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: false }),
  p('scheduled.manage',         'Gestionar',                   T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: false }),
  p('scheduled.manage.edit',    'Editar Pago',                 T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: false }),
  p('scheduled.manage.delete',  'Eliminar Pago',               T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: false }),
];

// ── module.Investments (order 8) ──────────────────────────────────────────────
const INVESTMENTS: PermEntry[] = [
  p('investment.view',              'Ver Inversiones',          T,   T),
  p('investment.view.list',         'Listar Inversiones',       Ro,  Ro),
  p('investment.view.detail',       'Detalles de Inversión',    Ro,  Ro),
  p('investment.view.detail_sheet', 'Hoja de detalle',          Ro,  Ro),
  p('investment.crud',              'Gestionar Inversiones',    T,   T),
  p('investment.crud.create',       'Crear Inversión',          T,   T),
  p('investment.crud.edit',         'Editar Inversión',         T,   T),
  p('investment.crud.delete',       'Eliminar Inversión',       T,   T),
  p('investment.payments',          'Pagos',                    T,   T),
  p('investment.payments.add',      'Registrar Pago',           T,   T),
  p('investment.payments.history',  'Historial de Pagos',       Ro,  Ro),
];

// ── module.MSI (order 9) ──────────────────────────────────────────────────────
const MSI: PermEntry[] = [
  p('msi.view',              'Ver MSI',            T,   T),
  p('msi.view.list',         'Listar Compras MSI', Ro,  Ro),
  p('msi.view.track',        'Seguimiento',        Ro,  Ro),
  p('msi.view.detail_sheet', 'Hoja de detalle',    Ro,  Ro),
  p('msi.crud',              'Gestionar MSI',      T,   T),
  p('msi.crud.create',       'Registrar Compra',   T,   T),
  p('msi.crud.edit',         'Editar MSI',         T,   T),
  p('msi.crud.delete',       'Eliminar MSI',       T,   T),
  p('msi.payments',          'Pagos',              T,   T),
  p('msi.payments.record',   'Registrar Pago',     T,   T),
  p('msi.payments.history',  'Historial de Pagos', Ro,  Ro),
];

// ── module.Rentals (order 10) ─────────────────────────────────────────────────
const RENTALS: PermEntry[] = [
  p('rental.view',               'Ver Propiedades',         T,   T),
  p('rental.view.list',          'Listar Propiedades',      Ro,  Ro),
  p('rental.view.detail',        'Detalles de Propiedad',   Ro,  Ro),
  p('rental.view.detail_sheet',  'Hoja de detalle',         Ro,  Ro),
  p('rental.property',           'Gestionar Propiedades',   T,   T),
  p('rental.property.create',    'Registrar Propiedad',     T,   T),
  p('rental.property.edit',      'Editar Propiedad',        T,   T),
  p('rental.property.delete',    'Eliminar Propiedad',      T,   T),
  p('rental.payments',           'Pagos de Renta',          T,   T),
  p('rental.payments.record',    'Registrar Pago',          T,   T),
  p('rental.payments.reverse',   'Revertir Pago',           T,   T),
  p('rental.payments.history',   'Historial de Pagos',      Ro,  Ro),
];

// ── module.Catalogs (order 11) ────────────────────────────────────────────────
const CATALOGS: PermEntry[] = [
  p('catalog.categories',                   'Rubros',               T,   T),
  p('catalog.categories.view',              'Ver Rubros',           Ro,  Ro),
  p('catalog.categories.create',            'Crear Rubro',          T,   T),
  p('catalog.categories.edit',              'Editar Rubro',         T,   T),
  p('catalog.categories.delete',            'Eliminar Rubro',       T,   T),
  p('catalog.categories.exclude_from_totals','Excluir del total',   { can_read: true, can_write: true, can_modify: true, can_delete: false, can_view: true }, { can_read: true, can_write: true, can_modify: true, can_delete: false, can_view: true }),
  p('catalog.subcategories',                'SubRubros',            T,   T),
  p('catalog.subcategories.view',           'Ver SubRubros',        Ro,  Ro),
  p('catalog.subcategories.create',         'Crear SubRubro',       T,   T),
  p('catalog.subcategories.edit',           'Editar SubRubro',      T,   T),
  p('catalog.subcategories.delete',         'Eliminar SubRubro',    T,   T),
  p('catalog.persons',                      'Personas',             T,   T),
  p('catalog.persons.view',                 'Ver Personas',         Ro,  Ro),
  p('catalog.persons.create',               'Crear Persona',        T,   T),
  p('catalog.persons.edit',                 'Editar Persona',       T,   T),
  p('catalog.persons.delete',               'Eliminar Persona',     T,   T),
  p('catalog.methods',                      'Formas de Pago',       T,   T),
  p('catalog.methods.view',                 'Ver Formas',           Ro,  Ro),
  p('catalog.methods.create',               'Crear Forma',          T,   T),
  p('catalog.methods.edit',                 'Editar Forma',         T,   T),
  p('catalog.methods.delete',               'Eliminar Forma',       T,   T),
];

// ── module.FamilySettings (order 12) ──────────────────────────────────────────
const FAMILY_SETTINGS: PermEntry[] = [
  p('family.settings',          'Configuración',     T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  }),
  p('family.settings.basic',    'Datos Básicos',     T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: false }),
  p('family.settings.locale',   'Idioma y Moneda',   T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: false }),
  p('family.settings.advanced', 'Opciones Avanzadas',T,   { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: false }),
];

// ── module.AccountSettings (order 13) ─────────────────────────────────────────
const ACCOUNT_SETTINGS: PermEntry[] = [
  p('account.profile',          'Perfil',             T,   { can_read: true,  can_write: true,  can_modify: true,  can_delete: false, can_view: true  }),
  p('account.profile.view',     'Ver Información',    Ro,  Ro),
  p('account.profile.edit',     'Editar Perfil',      T,   { can_read: true,  can_write: true,  can_modify: true,  can_delete: false, can_view: true  }),
  p('account.profile.password', 'Cambiar Contraseña', { can_read: true, can_write: true, can_modify: true, can_delete: false, can_view: true }, { can_read: true, can_write: true, can_modify: true, can_delete: false, can_view: true }),
  p('account.profile.delete',   'Eliminar Cuenta',    { can_read: true, can_write: false, can_modify: false, can_delete: true, can_view: true }, { can_read: true, can_write: false, can_modify: false, can_delete: true, can_view: true }),
];

// ── module.FamilyAdmin (order 14) ─────────────────────────────────────────────
const FAMILY_ADMIN: PermEntry[] = [
  p('family.admin.members',          'Miembros',          T,       Closed),
  p('family.admin.members.view',     'Ver Miembros',      Ro,      Closed),
  p('family.admin.members.invite',   'Invitar Miembro',   T,       Closed),
  p('family.admin.members.approve',  'Aprobar Solicitudes',T,      Closed),
  p('family.admin.members.remove',   'Eliminar Miembro',  T,       Closed),
  p('family.admin.billing',          'Facturación',       T,       Closed),
  p('family.admin.billing.view',     'Ver Estado',        Ro,      Closed),
  p('family.admin.billing.upgrade',  'Mejorar Plan',      T,       Closed),
];

// ── module.PermissionAdmin (order 15) ─────────────────────────────────────────
const PERMISSION_ADMIN: PermEntry[] = [
  p('permission.manage',        'Gestionar Permisos', T,   Closed),
  p('permission.manage.view',   'Ver Matriz',         Ro,  Closed),
  p('permission.manage.edit',   'Editar Permisos',    T,   Closed),
  p('permission.manage.reset',  'Restablecer',        T,   Closed),
];

// ── module.LicenseAdmin (order 16) ────────────────────────────────────────────
const LICENSE_ADMIN: PermEntry[] = [
  p('license.manage',             'Gestionar Licencia',  Closed, Closed),
  p('license.manage.view',        'Ver Licencia',        Closed, Closed),
  p('license.manage.activate',    'Activar Licencia',    Closed, Closed),
  p('license.manage.deactivate',  'Desactivar Licencia', Closed, Closed),
];

// ── module.AIUsage (order 17) ─────────────────────────────────────────────────
const AI_USAGE: PermEntry[] = [
  p('ai.usage',        'Ver Uso',              Closed, Closed),
  p('ai.usage.view',   'Historial de Consumo', Closed, Closed),
  p('ai.usage.export', 'Exportar Historial',   Closed, Closed),
];

// ── module.UserManual (order 18) + module.About (order 19) ───────────────────
const DOCS: PermEntry[] = [
  p('docs.manual',      'Ver Manual',          Ro,  Ro),
  p('docs.manual.view', 'Acceder Documentación',Ro,  Ro),
  p('docs.about',       'Ver Información',     Ro,  Ro),
  p('docs.about.view',  'Acceder Información', Ro,  Ro),
];

export const ALL_PERMISSION_DEFAULTS: PermEntry[] = [
  ...DASHBOARD,
  ...TRANSACTIONS,
  ...CAPTURE,
  ...REPORTS,
  ...ASSISTANT,
  ...BUDGET,
  ...SCHEDULED,
  ...INVESTMENTS,
  ...MSI,
  ...RENTALS,
  ...CATALOGS,
  ...FAMILY_SETTINGS,
  ...ACCOUNT_SETTINGS,
  ...FAMILY_ADMIN,
  ...PERMISSION_ADMIN,
  ...LICENSE_ADMIN,
  ...AI_USAGE,
  ...DOCS,
];
