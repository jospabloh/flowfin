import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Unauthenticated: returns a PublicSnapshot by slug for the /s/:slug page.
 *
 * Body: { slug: string }
 *
 * Returns:
 *   { snapshot: { type, payload_json, views, created_date } }  on 200
 *   { error: 'not_found' | 'expired' | 'hidden' | 'bad_slug' } otherwise
 *
 * Uses asServiceRole so callers without a session can still read public
 * shareable snapshots. The fields we return are intentionally narrow —
 * family_id and created_by_user_id are never exposed to the public.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug || '').trim().toLowerCase();

    if (!slug || slug.length < 6 || slug.length > 24 || !/^[a-z0-9]+$/.test(slug)) {
      return Response.json({ error: 'bad_slug' }, { status: 400 });
    }

    const results = await base44.asServiceRole.entities.PublicSnapshot.filter({ slug });
    const snap = results?.[0];
    if (!snap) return Response.json({ error: 'not_found' }, { status: 404 });
    if (snap.is_public === false) return Response.json({ error: 'hidden' }, { status: 404 });
    if (snap.expires_at && new Date(snap.expires_at).getTime() < Date.now()) {
      return Response.json({ error: 'expired' }, { status: 410 });
    }

    // Increment view counter best-effort — never block the response.
    try {
      await base44.asServiceRole.entities.PublicSnapshot.update(snap.id, {
        views: (snap.views || 0) + 1,
      });
    } catch (viewErr: unknown) {
      const message = viewErr instanceof Error ? viewErr.message : String(viewErr);
      console.warn('[getPublicSnapshot] view increment failed:', message);
    }

    return Response.json({
      snapshot: {
        type: snap.type,
        slug: snap.slug,
        payload_json: snap.payload_json,
        views: (snap.views || 0) + 1,
        created_date: snap.created_date,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
