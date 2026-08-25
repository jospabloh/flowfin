import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Admin-only: backfill User.family_id for every user who has an approved
// FamilyMembership, so the Family RLS read rule `id === {{user.data.family_id}}`
// and FamilyContext resolve correctly. Fixes the population gap left after
// removing the User.family_id field-level rls.write lock (2026-08-25): some
// users had data.family_id set but the resolved top-level field null, and a
// fresh user with an approved membership but no family_id would be locked
// out of their own tenant (stuck on Onboarding).
//
// Idempotent: only writes when the stored family_id differs from the
// membership's. For users with 2+ approved memberships, pins the one that
// matches their current family_id (if any), else the most recently active —
// mirroring guardedEntityWrite.resolveFamilyAccess so reads and writes
// agree on which family is "current".

// The only fields this function reads off a membership record.
interface MembershipForBackfill {
  family_id: string;
  last_active_at?: string;
}

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const users = await sr.entities.User.list();
    const memberships = await sr.entities.FamilyMembership.filter({ status: 'approved' });

    // Index approved memberships by user_id and lowercased user_email.
    const byUserId = new Map<string, unknown[]>();
    const byEmail = new Map<string, unknown[]>();
    for (const m of memberships) {
      if (m.user_id) {
        if (!byUserId.has(m.user_id)) byUserId.set(m.user_id, []);
        byUserId.get(m.user_id)!.push(m);
      }
      if (m.user_email) {
        const key = String(m.user_email).toLowerCase();
        if (!byEmail.has(key)) byEmail.set(key, []);
        byEmail.get(key)!.push(m);
      }
    }

    const fixed: Array<Record<string, unknown>> = [];
    let scanned = 0;
    let skipped = 0;

    for (const u of users) {
      scanned++;
      let approved = byUserId.get(u.id) || [];
      if (!approved.length && u.email) {
        approved = byEmail.get(String(u.email).toLowerCase()) || [];
      }
      if (!approved.length) { skipped++; continue; }

      // Pick the membership to pin: prefer the user's current family_id if it
      // matches one of their approved memberships; else most recently active.
      const currentFid = (u.data as { family_id?: string } | undefined)?.family_id
        ?? (u as { family_id?: string }).family_id
        ?? null;
      let target = (approved as MembershipForBackfill[]).find((m) => m.family_id === currentFid);
      if (!target) {
        target = [...(approved as MembershipForBackfill[])].sort((a, b) =>
          String(b.last_active_at ?? '').localeCompare(String(a.last_active_at ?? ''))
        )[0];
      }
      const wantFid = target.family_id;

      // Only data.family_id is checked/written: it's the field FamilyContext
      // and the Family RLS rule `id === {{user.data.family_id}}` actually
      // read. The SDK's User.update({data}) doesn't sync the resolved
      // top-level family_id field, and the app never reads that top-level
      // field for tenant resolution, so chasing it would report a false
      // "fixed" every run.
      const dataFid = (u.data as { family_id?: string } | undefined)?.family_id ?? null;
      if (dataFid === wantFid) { skipped++; continue; }

      // Preserve the rest of the user's data (role, preferences). delete
      // userData.data avoids the SDK deep-merge nesting bug (same pattern as
      // createFamily/approveMember).
      const userData = { ...((u.data as Record<string, unknown>) || {}), family_id: wantFid };
      delete (userData as { data?: unknown }).data;
      await sr.entities.User.update(u.id, { data: userData });

      fixed.push({ id: u.id, email: u.email, from: dataFid, to: wantFid });
    }

    return Response.json({ success: true, scanned, fixed_count: fixed.length, skipped, fixed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
