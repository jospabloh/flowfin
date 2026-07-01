import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Admin-only: lists WaitlistSignup rows with computed leaderboard rank.
 *
 * Body: { limit?: number, only_pending?: boolean }
 *
 * Returns: { rows: WaitlistSignup[], total, pending, invited, joined }
 *
 * Sorted by referrals_count desc, then created_date asc (older signups
 * break ties, mirroring how Robinhood-style waitlists work).
 */
export async function handle(req: Request, body: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const limit = Math.min(1000, Math.max(1, Number(body?.limit) || 200));
    const onlyPending = body?.only_pending === true;

    const rows = await base44.asServiceRole.entities.WaitlistSignup.list() as Array<Record<string, unknown>>;
    const all = Array.isArray(rows) ? rows : [];

    const filtered = onlyPending ? all.filter((r) => !r.invited_at) : all;

    filtered.sort((a, b) => {
      const ra = Number(a.referrals_count || 0);
      const rb = Number(b.referrals_count || 0);
      if (rb !== ra) return rb - ra;
      const da = a.created_date ? new Date(String(a.created_date)).getTime() : 0;
      const db = b.created_date ? new Date(String(b.created_date)).getTime() : 0;
      return da - db;
    });

    const top = filtered.slice(0, limit);

    let pending = 0;
    let invited = 0;
    let joined = 0;
    for (const r of all) {
      if (r.joined_app_user_id) joined += 1;
      else if (r.invited_at) invited += 1;
      else pending += 1;
    }

    return Response.json({
      success: true,
      rows: top,
      total: all.length,
      pending,
      invited,
      joined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
