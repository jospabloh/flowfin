import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Admin-only: marks a batch of WaitlistSignup rows as invited.
 *
 * Body: { ids: string[] }
 *
 * Sets invited_at = now() on each id that isn't already invited. Returns
 * per-row outcome so the admin UI can render skipped rows clearly.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === 'string') : [];
    if (!ids.length) return Response.json({ error: 'no_ids' }, { status: 400 });

    const nowIso = new Date().toISOString();
    const results: Array<{ id: string; outcome: 'invited' | 'skipped' | 'error'; reason?: string }> = [];

    for (const id of ids) {
      try {
        const rows = await base44.asServiceRole.entities.WaitlistSignup.filter({ id });
        const row = rows?.[0];
        if (!row) {
          results.push({ id, outcome: 'skipped', reason: 'not_found' });
          continue;
        }
        if (row.invited_at) {
          results.push({ id, outcome: 'skipped', reason: 'already_invited' });
          continue;
        }
        await base44.asServiceRole.entities.WaitlistSignup.update(id, { invited_at: nowIso });
        results.push({ id, outcome: 'invited' });
      } catch (rowErr: unknown) {
        const message = rowErr instanceof Error ? rowErr.message : String(rowErr);
        results.push({ id, outcome: 'error', reason: message });
      }
    }

    const invitedCount = results.filter((r) => r.outcome === 'invited').length;
    return Response.json({ success: true, invited: invitedCount, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
