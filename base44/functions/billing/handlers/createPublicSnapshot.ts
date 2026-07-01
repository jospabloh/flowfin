import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const VALID_TYPES = new Set(['goal_achieved', 'trip_summary', 'monthly_report', 'budget_kept']);
const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SLUG_LENGTH = 10;
const DEFAULT_TTL_DAYS = 90;

function randomSlug(): string {
  let out = '';
  for (let i = 0; i < SLUG_LENGTH; i += 1) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return out;
}

/**
 * Authenticated: creates a PublicSnapshot for the caller's family.
 *
 * Body: {
 *   type: 'goal_achieved' | 'trip_summary' | 'monthly_report' | 'budget_kept',
 *   payload: { ... },   // already-anonymised payload built client-side
 *   ttl_days?: number,  // defaults to 90
 * }
 *
 * Returns: { success, slug, url, snapshot }
 *
 * Notes
 * - Payload is stored as-is; the client is responsible for anonymising
 *   (no Person.name, no exact bank account numbers, etc).
 * - Slug uniqueness is enforced by retrying up to 5 times before failing.
 * - Family must own the request; this function does NOT use asServiceRole
 *   so RLS gates the create call.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const familyId = user?.data?.family_id || user?.data?.data?.family_id;
    if (!familyId) {
      return Response.json({ error: 'no_family' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const type = String(body?.type || '');
    const payload = body?.payload;
    const ttlDays = Number.isFinite(body?.ttl_days) ? Math.min(365, Math.max(1, Number(body.ttl_days))) : DEFAULT_TTL_DAYS;

    if (!VALID_TYPES.has(type)) {
      return Response.json({ error: 'invalid_type' }, { status: 400 });
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return Response.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

    let snapshot: { id: string; slug: string } | null = null;
    let attempts = 0;
    while (attempts < 5 && !snapshot) {
      attempts += 1;
      const candidate = randomSlug();
      const collisions = await base44.asServiceRole.entities.PublicSnapshot.filter({ slug: candidate });
      if (collisions?.length) continue;
      try {
        snapshot = await base44.entities.PublicSnapshot.create({
          family_id: familyId,
          created_by_user_id: user.id,
          type,
          slug: candidate,
          payload_json: payload,
          is_public: true,
          views: 0,
          expires_at: expiresAt,
        });
      } catch (createErr: unknown) {
        // Most likely a race condition on slug uniqueness — retry.
        const message = createErr instanceof Error ? createErr.message : String(createErr);
        if (attempts >= 5) {
          return Response.json({ error: `create_failed:${message}` }, { status: 500 });
        }
      }
    }

    if (!snapshot) {
      return Response.json({ error: 'slug_collision' }, { status: 500 });
    }

    return Response.json({
      success: true,
      slug: snapshot.slug,
      url: `/s/${snapshot.slug}`,
      snapshot,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
