/**
 * aggregator.js — combines per-folder permission manifests via import.meta.glob
 * and exposes PERMISSION_REGISTRY + DEFAULT_MATRIX with the same shape as the
 * original registry.js.
 *
 * Each manifest default export can be either:
 *   - A single { module, sections, actions, defaults } object, or
 *   - An array of such objects (used by docs.permissions.js for UserManual + About)
 */

import { PERMISSION_COLUMNS, getDefaultPermission as _getDefaultPermission } from './columns.js';

// --- Vite glob imports (eager = loaded at build time, no dynamic import needed) ---
const componentManifests = import.meta.glob(
  '/src/components/**/permissions.js',
  { eager: true }
);

const pageManifests = import.meta.glob(
  '/src/pages/permissions/*.permissions.js',
  { eager: true }
);

// Combine all manifest default exports into a flat array of manifest objects
function collectManifests(globResult) {
  const manifests = [];
  for (const mod of Object.values(globResult)) {
    const def = mod.default;
    if (!def) continue;
    if (Array.isArray(def)) {
      manifests.push(...def);
    } else {
      manifests.push(def);
    }
  }
  return manifests;
}

const allManifests = [
  ...collectManifests(componentManifests),
  ...collectManifests(pageManifests),
];

// Sort manifests by module.order so PERMISSION_REGISTRY is ordered consistently
allManifests.sort((a, b) => (a.module?.order ?? 999) - (b.module?.order ?? 999));

// --- Build PERMISSION_REGISTRY ---
export const PERMISSION_REGISTRY = [];

for (const manifest of allManifests) {
  const { module: mod, sections = [], actions = [] } = manifest;
  if (!mod) continue;

  // Module entry
  PERMISSION_REGISTRY.push({ key: mod.key, kind: 'module', label: mod.label, order: mod.order });

  // Sections sorted by their order within this module
  const sortedSections = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const sec of sortedSections) {
    PERMISSION_REGISTRY.push({ key: sec.key, kind: 'section', parent: mod.key, label: sec.label, order: sec.order });

    // Actions that belong to this section
    const sectionActions = actions.filter(a => a.parent === sec.key);
    for (const act of sectionActions) {
      PERMISSION_REGISTRY.push({ key: act.key, kind: 'action', parent: act.parent, label: act.label });
    }
  }
}

// --- Build DEFAULT_MATRIX ---
export const DEFAULT_MATRIX = { admin: {}, member: {} };

for (const manifest of allManifests) {
  const { defaults = {} } = manifest;
  if (defaults.admin) {
    Object.assign(DEFAULT_MATRIX.admin, defaults.admin);
  }
  if (defaults.member) {
    Object.assign(DEFAULT_MATRIX.member, defaults.member);
  }
}

// --- Re-export columns helpers ---
export { PERMISSION_COLUMNS };

// Override getDefaultPermission to use the aggregated DEFAULT_MATRIX
export function getDefaultPermission(role, permissionKey) {
  const OPEN_PERMISSION  = { can_read: true,  can_write: true,  can_modify: true,  can_delete: true,  can_view: true  };
  const CLOSED_PERMISSION = { can_read: false, can_write: false, can_modify: false, can_delete: false, can_view: false };
  return DEFAULT_MATRIX[role]?.[permissionKey] ?? (role === 'admin' ? OPEN_PERMISSION : CLOSED_PERMISSION);
}
