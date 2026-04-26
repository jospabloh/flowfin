/**
 * registry.js — thin re-export for backwards compatibility.
 * All consumers importing from this file continue to work unchanged.
 * The actual implementation lives in aggregator.js.
 */
export { PERMISSION_REGISTRY, DEFAULT_MATRIX, PERMISSION_COLUMNS, getDefaultPermission } from './aggregator';
