/**
 * PERMISSION REGISTRY — fuente de verdad central de todos los artefactos de la app.
 *
 * REGLA DE ORO: Agregar una entrada aquí es la ÚNICA manera de registrar un nuevo
 * artefacto (página, sección, acción) en el sistema de permisos. Nunca comparar
 * roles manualmente en los componentes; usar siempre usePermission().
 *
 * DEFAULT_MATRIX congela el comportamiento actual de la app para cada rol.
 * Esto garantiza que el sistema de permisos sea ADITIVO: hasta que un admin
 * cambie explícitamente un permiso, cada rol ve exactamente lo que veía antes.
 */

export const PERMISSION_REGISTRY = [
  // ── Páginas principales ─────────────────────────────────────────────────────
  { key: 'page.Dashboard',          kind: 'page',    label: 'Inicio',            order: 1 },
  { key: 'page.Transactions',       kind: 'page',    label: 'Movimientos',       order: 2 },
  { key: 'page.Capture',            kind: 'page',    label: 'Registrar',         order: 3 },
  { key: 'page.Reports',            kind: 'page',    label: 'Reportes',          order: 4 },
  { key: 'page.Assistant',          kind: 'page',    label: 'Asistente IA',      order: 5 },
  { key: 'page.Budget',             kind: 'page',    label: 'Presupuesto',       order: 6 },
  { key: 'page.ScheduledPayments',  kind: 'page',    label: 'Pagos del Mes',     order: 7 },
  { key: 'page.Investments',        kind: 'page',    label: 'Inversiones',       order: 8 },
  { key: 'page.MSI',                kind: 'page',    label: 'MSI',               order: 9 },
  { key: 'page.Rentals',            kind: 'page',    label: 'Rentas',            order: 10 },
  { key: 'page.Catalogs',           kind: 'page',    label: 'Catálogos',         order: 11 },
  { key: 'page.FamilySettings',     kind: 'page',    label: 'Mi Familia',        order: 12 },
  { key: 'page.AccountSettings',    kind: 'page',    label: 'Mi Cuenta',         order: 13 },
  { key: 'page.UserManual',         kind: 'page',    label: 'Manual de Usuario', order: 14 },
  { key: 'page.About',              kind: 'page',    label: 'Acerca de',         order: 15 },

  // ── Páginas de administración (solo admin familia) ───────────────────────────
  { key: 'page.FamilyAdmin',        kind: 'page',    label: 'Admin Familia',     order: 16 },
  { key: 'page.PermissionAdmin',    kind: 'page',    label: 'Permisos',          order: 17 },

  // ── Páginas de sistema (solo platform admin) ─────────────────────────────────
  { key: 'page.LicenseAdmin',       kind: 'page',    label: 'Licencias',         order: 18 },
  { key: 'page.AIUsage',            kind: 'page',    label: 'Uso de IA',         order: 19 },

  // ── Secciones de Catálogos ───────────────────────────────────────────────────
  { key: 'section.Catalogs.Categories',    kind: 'section', parent: 'page.Catalogs', label: 'Rubros',          order: 1 },
  { key: 'section.Catalogs.Subcategories', kind: 'section', parent: 'page.Catalogs', label: 'SubRubros',       order: 2 },
  { key: 'section.Catalogs.Persons',       kind: 'section', parent: 'page.Catalogs', label: 'Personas',        order: 3 },
  { key: 'section.Catalogs.Methods',       kind: 'section', parent: 'page.Catalogs', label: 'Formas de Pago',  order: 4 },

  // ── Acciones sobre Movimientos ───────────────────────────────────────────────
  { key: 'action.Transaction.create', kind: 'action', parent: 'page.Transactions', label: 'Registrar movimiento', order: 1 },
  { key: 'action.Transaction.update', kind: 'action', parent: 'page.Transactions', label: 'Editar movimiento',    order: 2 },
  { key: 'action.Transaction.delete', kind: 'action', parent: 'page.Transactions', label: 'Eliminar movimiento',  order: 3 },

  // ── Acciones sobre Pagos Programados ────────────────────────────────────────
  { key: 'action.ScheduledPayment.create', kind: 'action', parent: 'page.ScheduledPayments', label: 'Agregar pago programado',   order: 1 },
  { key: 'action.ScheduledPayment.update', kind: 'action', parent: 'page.ScheduledPayments', label: 'Editar pago programado',     order: 2 },
  { key: 'action.ScheduledPayment.delete', kind: 'action', parent: 'page.ScheduledPayments', label: 'Eliminar pago programado',   order: 3 },

  // ── Acciones sobre Admin Familia ─────────────────────────────────────────────
  { key: 'action.FamilyAdmin.invite',   kind: 'action', parent: 'page.FamilyAdmin', label: 'Invitar miembro',    order: 1 },
  { key: 'action.FamilyAdmin.approve',  kind: 'action', parent: 'page.FamilyAdmin', label: 'Aprobar miembro',    order: 2 },
  { key: 'action.FamilyAdmin.remove',   kind: 'action', parent: 'page.FamilyAdmin', label: 'Eliminar miembro',   order: 3 },
];

// Columnas de permisos disponibles por artefacto
export const PERMISSION_COLUMNS = [
  { key: 'can_read',   label: 'Leer',     description: 'Puede consultar y listar registros' },
  { key: 'can_write',  label: 'Crear',    description: 'Puede crear nuevos registros' },
  { key: 'can_modify', label: 'Modificar',description: 'Puede editar registros existentes' },
  { key: 'can_delete', label: 'Eliminar', description: 'Puede borrar registros' },
  { key: 'can_view',   label: 'Ver',      description: 'La sección/página es visible en la navegación' },
];

/**
 * DEFAULT_MATRIX — congela el comportamiento actual de la app.
 *
 * true  = permitido (igual que hoy)
 * false = denegado  (igual que hoy)
 *
 * Cualquier key no listado aquí se resuelve como { can_read: true, can_write: true,
 * can_modify: true, can_delete: true, can_view: true } para 'admin' y para 'member'
 * solo can_view: true (acceso conservador).
 */
export const DEFAULT_MATRIX = {
  admin: {
    // Todas las páginas visibles y con acceso completo para admin de familia
    'page.Dashboard':         { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.Transactions':      { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.Capture':           { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.Reports':           { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.Assistant':         { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.Budget':            { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.ScheduledPayments': { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.Investments':       { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.MSI':               { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.Rentals':           { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.Catalogs':          { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.FamilySettings':    { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.AccountSettings':   { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.UserManual':        { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
    'page.About':             { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
    'page.FamilyAdmin':       { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.PermissionAdmin':   { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    // Sistema — solo platform admin los ve, pero el admin de familia no puede cambiar esto
    'page.LicenseAdmin':      { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'page.AIUsage':           { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    // Secciones
    'section.Catalogs.Categories':    { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'section.Catalogs.Subcategories': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'section.Catalogs.Persons':       { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'section.Catalogs.Methods':       { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    // Acciones
    'action.Transaction.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'action.Transaction.update': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'action.Transaction.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'action.ScheduledPayment.create': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'action.ScheduledPayment.update': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'action.ScheduledPayment.delete': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'action.FamilyAdmin.invite':  { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'action.FamilyAdmin.approve': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'action.FamilyAdmin.remove':  { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
  },
  member: {
    // Miembros regulares: ven y leen todo lo que existía antes, pero sin acceso a admin
    'page.Dashboard':         { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
    'page.Transactions':      { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.Capture':           { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  },
    'page.Reports':           { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
    'page.Assistant':         { can_read: true,  can_write: true,  can_modify: false, can_delete: false, can_view: true  },
    'page.Budget':            { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.ScheduledPayments': { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
    'page.Investments':       { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.MSI':               { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.Rentals':           { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.Catalogs':          { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  },
    'page.FamilySettings':    { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
    'page.AccountSettings':   { can_read: true,  can_write: true,  can_modify: true,  can_delete: false, can_view: true  },
    'page.UserManual':        { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
    'page.About':             { can_read: true,  can_write: false, can_modify: false, can_delete: false, can_view: true  },
    'page.FamilyAdmin':       { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'page.PermissionAdmin':   { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'page.LicenseAdmin':      { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'page.AIUsage':           { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    // Secciones
    'section.Catalogs.Categories':    { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'section.Catalogs.Subcategories': { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'section.Catalogs.Persons':       { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    'section.Catalogs.Methods':       { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true },
    // Acciones
    'action.Transaction.create': { can_read: true, can_write: true,  can_modify: true,  can_delete: false, can_view: true },
    'action.Transaction.update': { can_read: true, can_write: false, can_modify: true,  can_delete: false, can_view: true },
    'action.Transaction.delete': { can_read: true, can_write: false, can_modify: false, can_delete: true,  can_view: true },
    'action.ScheduledPayment.create': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'action.ScheduledPayment.update': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'action.ScheduledPayment.delete': { can_read: true, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'action.FamilyAdmin.invite':  { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'action.FamilyAdmin.approve': { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
    'action.FamilyAdmin.remove':  { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false },
  },
};

// Valor fallback cuando un key no existe en DEFAULT_MATRIX
const OPEN_PERMISSION = { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true };
const CLOSED_PERMISSION = { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false };

export function getDefaultPermission(role, permissionKey) {
  return DEFAULT_MATRIX[role]?.[permissionKey] ?? (role === 'admin' ? OPEN_PERMISSION : CLOSED_PERMISSION);
}
