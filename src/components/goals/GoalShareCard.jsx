import { useMemo, useState } from 'react';
import { Share2, Loader2, Check } from 'lucide-react';
import { createSnapshot, shareSnapshot } from '@/lib/publicSnapshots';
import { track } from '@/lib/analytics';

/**
 * Inline CTA shown above a completed Goal card. Clicking creates a
 * PublicSnapshot via the backend function and immediately opens the share
 * sheet (or WhatsApp fallback) with the resulting /s/:slug URL.
 *
 * Payload is anonymised here — no Person ids, no full goal description.
 */
export default function GoalShareCard({ goal, savedAmount, currency }) {
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState('');

  const daysToComplete = useMemo(() => {
    if (!goal?.created_date) return null;
    const start = new Date(goal.created_date).getTime();
    if (!isFinite(start)) return null;
    const days = Math.max(1, Math.round((Date.now() - start) / 86400000));
    return days;
  }, [goal?.created_date]);

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { slug } = await createSnapshot({
        type: 'goal_achieved',
        payload: {
          goal_name: (goal?.name || '').trim().slice(0, 60),
          amount: Math.round((savedAmount || 0) + (goal?.manual_saved || 0)),
          currency: currency || 'MXN',
          ...(daysToComplete ? { days_to_complete: daysToComplete } : {}),
        },
        ttl_days: 90,
      });
      await shareSnapshot({
        slug,
        type: 'goal_achieved',
        title: 'Logré mi meta en FlowFin',
        message: `Acabo de cerrar la meta "${goal?.name || ''}" en FlowFin.`,
      });
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch (err) {
      track('snapshot_create_failed', { type: 'goal_achieved', reason: err?.message || 'unknown' });
      setError('No pudimos generar el resumen. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">¡Meta alcanzada!</p>
        <p className="text-xs text-muted-foreground truncate">Comparte tu logro sin exponer nombres.</p>
        {error && <p className="text-[11px] text-destructive mt-1">{error}</p>}
      </div>
      <button
        type="button"
        onClick={handleShare}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : shared
            ? <Check className="w-3.5 h-3.5" />
            : <Share2 className="w-3.5 h-3.5" />}
        {shared ? 'Listo' : busy ? 'Generando…' : 'Compartir'}
      </button>
    </div>
  );
}
