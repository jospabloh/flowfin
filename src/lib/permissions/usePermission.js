import { useFamily } from '@/lib/FamilyContext';
import { getDefaultPermission } from './registry';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * usePermission — hook central para verificar permisos sobre artefactos de la app.
 *
 * Resolución en tres capas (mayor prioridad primero):
 *   1. Platform admin (User.role === 'admin') → acceso total, siempre.
 *   2. RolePermission en BD (por familia + rol + permission_key).
 *   3. Fallback a DEFAULT_MATRIX (congela comportamiento actual).
 *
 * @param {string} permissionKey — key del artefacto, e.g. 'page.FamilyAdmin'
 * @returns {{ can_read, can_write, can_modify, can_delete, can_view }}
 */
export function usePermission(permissionKey) {
  const { currentUser, membership, familyId } = useFamily();
  const role = membership?.role ?? 'member';

  // Capa 2: Fetch RolePermission desde BD
  const { data: dbPerms } = useQuery({
    queryKey: ['rolePermissions', familyId, role, permissionKey],
    queryFn: async () => {
      if (!familyId) return null;
      try {
        const results = await base44.entities.RolePermission.filter({
          family_id: familyId,
          role: role,
          permission_key: permissionKey,
        });
        return results?.[0] ?? null;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
    enabled: !!familyId,
  });

  // Capa 1: platform admin siempre tiene acceso total
  if (currentUser?.role === 'admin') {
    return { can_read: true, can_write: true, can_modify: true, can_delete: true, can_view: true };
  }

  // Si existe permiso en BD, úsalo
  if (dbPerms) {
    return {
      can_read: dbPerms.can_read ?? true,
      can_write: dbPerms.can_write ?? true,
      can_modify: dbPerms.can_modify ?? true,
      can_delete: dbPerms.can_delete ?? true,
      can_view: dbPerms.can_view ?? true,
    };
  }

  // Capa 3: Fallback a DEFAULT_MATRIX
  return getDefaultPermission(role, permissionKey);
}

/**
 * useCanView — shorthand para verificar solo visibilidad.
 * Útil para condicionar la navegación y renderizado de secciones.
 */
export function useCanView(permissionKey) {
  return usePermission(permissionKey).can_view;
}