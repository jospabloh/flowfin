import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ONE-TIME MIGRATION: Run once at launch.
// Sets view_only_since = now for all families currently in view_only that have no
// view_only_since anchor. This gives each of them a fresh 15-day window before
// checkAccountLifecycle transitions them to archived.
// Admin-only endpoint.
export async function handle(req: Request, body: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const nowISO = new Date().toISOString();

    const viewOnlyFamilies = await base44.asServiceRole.entities.Family.filter({
      billing_status: 'view_only',
    });

    let migrated = 0;
    const names: string[] = [];

    for (const family of viewOnlyFamilies) {
      if (!family.view_only_since) {
        await base44.asServiceRole.entities.Family.update(family.id, {
          view_only_since: nowISO,
        });
        migrated++;
        names.push(family.name ?? family.id);
      }
    }

    console.log(`[migrateViewOnlySince] Migrated ${migrated} families:`, names.join(', '));
    return Response.json({ success: true, migrated, families: names, timestamp: nowISO });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error('[migrateViewOnlySince] Error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
