import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { isFamilyAdmin } from './_userMemberships.ts';

// Lists every membership (pending + approved) of the caller's own family,
// for the "Admin Familia" screen. Server-side read via service role —
// the client used to call `base44.entities.FamilyMembership.filter({family_id})`
// directly, trusting RLS's `data.family_id: "{{user.data.family_id}}"` branch
// to scope it. Confirmed live (2026-10-01, throwaway QA family, not
// production data) that branch does not match even for a freshly created
// family whose admin's own `User.data.family_id` is correct and a fresh
// login was done — so an admin's own pending join requests never rendered,
// and approve/reject were unreachable from the UI. Root cause not
// identified (schema/platform-level, not this app's data or write path);
// this function sidesteps it the same way rumbo/liuma/cateqhub route an
// unreliable client read through a service-role function, instead of
// guessing further against the RLS engine on a production app with real
// family financial data. See CLAUDE.md.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { family_id } = await req.json();
    if (!family_id) return Response.json({ error: 'Missing family_id' }, { status: 400 });

    const sr = base44.asServiceRole;

    // Same authorization as approveMember/rejectMember: platform owner or an
    // approved admin of THIS family, re-checked from storage.
    if (!(await isFamilyAdmin(sr, user, family_id))) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const memberships = await sr.entities.FamilyMembership.filter({ family_id });
    return Response.json({ memberships: memberships || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
