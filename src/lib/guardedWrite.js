import { base44 } from '@/api/base44Client';

/**
 * Thin client wrapper around the guardedEntityWrite Safe function — the
 * sanctioned write path for the 16 family-scoped entities the web UI writes
 * directly (Transaction, Category, Subcategory, Person, PaymentMethod,
 * CategoryBudget, Goal, Investment, InvestmentPayment, MSI, MSIPayment,
 * RentalProperty, RentalPayment, ScheduledPayment, ScheduledPaymentRecord,
 * Trip). See base44/functions/guardedEntityWrite/entry.ts for why this
 * exists and what it enforces (RolePermission + billing read-only gate).
 *
 * Call sites that used to write these entities directly via
 * base44.entities.X.create/update/delete(...) go through here instead — same
 * calling shape (data in, record out) so migrating a call site is a
 * near-mechanical swap. `functions.invoke` returns the raw axios response
 * (see node_modules/@base44/sdk/dist/modules/functions.js — it's a bare
 * `axios.post(...)`, no unwrapping), so the JSON body is under `.data`,
 * matching every other call site in this repo (e.g. useSessionManager.js's
 * `res.data.session`). On denial it throws with `error.response.status`/
 * `error.response.data.error`/`error.response.data.code`.
 */
export async function guardedCreate(entity, data) {
  const result = await base44.functions.invoke('guardedEntityWrite', { entity, operation: 'create', data });
  return result?.data?.record;
}

export async function guardedUpdate(entity, id, data) {
  const result = await base44.functions.invoke('guardedEntityWrite', { entity, operation: 'update', id, data });
  return result?.data?.record;
}

export async function guardedDelete(entity, id) {
  await base44.functions.invoke('guardedEntityWrite', { entity, operation: 'delete', id });
}
