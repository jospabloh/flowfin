/**
 * Permission column definitions and helper utilities.
 * Extracted from registry.js for reuse across aggregator and manifests.
 */

export const PERMISSION_COLUMNS = [
  { key: 'can_read',   label: 'Leer',      description: 'Puede ver/leer' },
  { key: 'can_write',  label: 'Crear',     description: 'Puede crear' },
  { key: 'can_modify', label: 'Modificar', description: 'Puede editar' },
  { key: 'can_delete', label: 'Eliminar',  description: 'Puede borrar' },
  { key: 'can_view',   label: 'Visible',   description: 'Visible en navegación' },
];

const OPEN_PERMISSION  = { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  };
const CLOSED_PERMISSION = { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false };

export function getDefaultPermission(role, permissionKey) {
  // This function is fulfilled by aggregator; re-exported here for convenience.
  // The real implementation lives in aggregator.js which imports DEFAULT_MATRIX.
  // This stub is intentionally empty — callers should import from aggregator.js.
  void permissionKey;
  return role === 'admin' ? OPEN_PERMISSION : CLOSED_PERMISSION;
}
