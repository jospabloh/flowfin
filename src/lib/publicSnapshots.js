import { base44 } from '@/api/base44Client';
import { track } from '@/lib/analytics';

/**
 * Build a public snapshot URL from a slug. Centralised so the share UI and
 * the canonical link rendering stay aligned.
 */
export function snapshotUrl(slug) {
  if (!slug) return '';
  const origin = (typeof globalThis !== 'undefined' && globalThis.location?.origin)
    || 'https://app.flowfin.com';
  return `${origin}/s/${slug}`;
}

/**
 * Call the createPublicSnapshot backend function with a pre-anonymised
 * payload. Returns the URL and slug on success, throws on failure.
 *
 * `payload` is stored as-is — callers must drop any PII before calling.
 */
export async function createSnapshot({ type, payload, ttl_days }) {
  const res = await base44.functions.invoke('billing', { action: 'createPublicSnapshot',
    type,
    payload,
    ...(ttl_days ? { ttl_days } : {}),
  });
  if (res?.data?.error || res?.error) {
    throw new Error(res?.data?.error || res?.error || 'snapshot_create_failed');
  }
  const slug = res?.data?.slug;
  if (!slug) throw new Error('snapshot_missing_slug');
  track('snapshot_created', { type });
  return { slug, url: snapshotUrl(slug) };
}

/**
 * Fire the platform share sheet (or WhatsApp fallback) with a snapshot URL
 * and a localized message. Returns the method used for analytics.
 */
export async function shareSnapshot({ slug, type, title, message }) {
  const url = snapshotUrl(slug);
  const text = `${message}\n\n${url}`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      track('snapshot_share_clicked', { type, method: 'native_share' });
      return 'native_share';
    } catch {
      // user cancelled or share unavailable
    }
  }
  const fallback = `https://wa.me/?text=${encodeURIComponent(text)}`;
  globalThis.open?.(fallback, '_blank', 'noopener');
  track('snapshot_share_clicked', { type, method: 'whatsapp_fallback' });
  return 'whatsapp_fallback';
}
