import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Entities whose RLS lets a family member read their own family's rows
// (see CLAUDE.md's RLS section — family_id-scoped, non-admin-readable).
// Runs on the caller's own client (not asServiceRole), same as
// deleteAccount.ts's own pattern, so RLS itself does the tenant scoping —
// no separate business_id/family_id check needed here.
const FAMILY_ENTITIES = [
  'Transaction', 'Category', 'Subcategory', 'CategoryBudget', 'Person',
  'PaymentMethod', 'Goal', 'Investment', 'InvestmentPayment', 'MSI',
  'MSIPayment', 'RentalProperty', 'RentalPayment', 'ScheduledPayment',
  'ScheduledPaymentRecord', 'Trip',
];

/**
 * "Descargar mis datos" — module 7 (cuenta y zona de peligro) of the
 * portfolio standard requires a self-service data export, not just a
 * delete-account flow. Returns every FAMILY_ENTITIES row for the caller's
 * family as one JSON payload; AccountSettings.jsx turns it into a
 * client-side download (data: URI, no server-side file storage needed).
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const familyId = user.family_id;
    if (!familyId) {
      return Response.json({ error: 'No perteneces a ninguna familia' }, { status: 400 });
    }

    const data: Record<string, unknown[]> = {};
    for (const entity of FAMILY_ENTITIES) {
      try {
        data[entity] = await base44.entities[entity].filter({ family_id: familyId });
      } catch (e) {
        // RLS or a transient error on one entity shouldn't fail the whole
        // export — record it and keep going so the user still gets the rest.
        data[entity] = [];
        console.log(`[exportFamilyData] ${entity} failed: ${(e as Error).message}`);
      }
    }

    return Response.json({
      success: true,
      exported_at: new Date().toISOString(),
      family_id: familyId,
      data,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
