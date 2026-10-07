// ok below 80%, near from 80% until full, full at or over the limit.
// An unlimited plan (limit not finite) never fills, and draws no bar at all.
// A limit of 0 means none allowed: that is full, not ok.
// Used by the mario_style life bar (.play-hp in src/styles/mario_style.css).
export function quotaTone(used, limit) {
  if (!Number.isFinite(limit)) return 'ok';
  if (limit <= 0) return 'full';
  const r = used / limit;
  return r >= 1 ? 'full' : r >= 0.8 ? 'near' : 'ok';
}
