import { useFamily } from '@/lib/FamilyContext';
import { getDefaultPermission } from './registry';

/**
 * usePermission — hook central para verificar permisos sobre artefactos de la app.
 *
 * Resolución en tres capas (mayor prioridad primero):
 *   1. Platform admin (User.role === 'admin') → acceso total, siempre.
 *   2. Override por membresía (futuro: MembershipPermission en DB).
 *   3. Permiso por rol (RolePermission en DB, con fallback a DEFAULT_MATRIX).
 *
 * @param {string} permissionKey — key del artefacto, e.g. 'page.FamilyAdmin'
 * @returns {{ can_read, can_write, can_modify, can_delete, can_view }}
 */
export function usePermission(permissionKey) {
  const { currentUser, membership } = useFamily();

  // Capa 1: platform admin siempre tiene acceso total
  if (currentUser?.role === 'admin') {
    return { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true };
  }

  const role = membership?.role ?? 'member';

  // Capa 2 (futuro): aquí irán los overrides por membresía desde DB
  // const override = permissionOverrides?.[membership?.id]?.[permissionKey];
  // if (override) return override;

  // Capa 3: DEFAULT_MATRIX (congela el comportamiento actual de la app)
  return getDefaultPermission(role, permissionKey);
}

/**
 * useCanView — shorthand para verificar solo visibilidad.
 * Útil para condicionar la navegación y renderizado de secciones.
 */
export function useCanView(permissionKey) {
  return usePermission(permissionKey).can_view;
}
