import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { loadUserMemberships } from './_userMemberships.ts';

// The caller withdraws their own PENDING join requests (so they can ask
// another family, or create their own). Only the caller's own pending rows are
// touched; approved memberships are never deleted here.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole;
    const mine = (await loadUserMemberships(sr, user)).filter((m) => m.status === 'pending');
    for (const m of mine) {
      await sr.entities.FamilyMembership.delete(m.id);
    }
    return Response.json({ success: true, cancelled: mine.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
