import { useState, useMemo } from 'react';
import { useFamily } from '@/lib/FamilyContext';
import { Copy, Share2, Check, MessageCircle, Users } from 'lucide-react';
import { track } from '@/lib/analytics';

function buildJoinUrl(joinCode, refUserId) {
  if (!joinCode) return '';
  const base = (typeof globalThis !== 'undefined' && globalThis.location?.origin)
    || 'https://app.flowfin.com';
  const params = new URLSearchParams({ code: joinCode });
  if (refUserId) params.set('ref', refUserId);
  return `${base}/Onboarding?${params.toString()}`;
}

function buildShareMessage(joinUrl, joinCode, familyName) {
  const nameLine = familyName ? ` "${familyName}"` : '';
  return `Únete a mi familia${nameLine} en FlowFin para llevar nuestras finanzas juntos.\n\nCódigo: ${joinCode}\n\n${joinUrl}`;
}

/**
 * Reusable invite surface — used post-onboarding ("Invita a tu familia") and
 * from FamilyAdmin (replacing the bare copy-button) to ship the same
 * referral-tracking link in every share.
 */
export default function InviteShareCard({
  variant = 'card',
  title = '¡Invita a tu familia!',
  subtitle = 'Comparte tu código para que se unan en segundos.',
  onSkip,
  skipLabel = 'Saltar por ahora',
}) {
  const { family, currentUser } = useFamily();
  const joinCode = family?.join_code || '';
  const refUserId = currentUser?.id || '';
  const familyName = family?.name || '';

  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const joinUrl = useMemo(() => buildJoinUrl(joinCode, refUserId), [joinCode, refUserId]);
  const shareMessage = useMemo(() => buildShareMessage(joinUrl, joinCode, familyName), [joinUrl, joinCode, familyName]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(shareMessage);
      setCopied(true);
      track('invite_copied', { variant });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore — fallback button below still works
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Únete a mi familia en FlowFin',
          text: shareMessage,
          url: joinUrl,
        });
        track('invite_shared', { variant, method: 'native_share' });
        setShared(true);
        setTimeout(() => setShared(false), 1800);
        return;
      } catch {
        // user cancelled or share unavailable — fall through to WhatsApp
      }
    }
    track('invite_shared', { variant, method: 'whatsapp_fallback' });
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    globalThis.open?.(waUrl, '_blank', 'noopener');
  };

  if (!joinCode) return null;

  const isCompact = variant === 'compact';

  return (
    <div className={isCompact
      ? 'rounded-2xl border border-primary/20 bg-primary/5 p-4'
      : 'rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm'}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`rounded-2xl bg-primary/15 text-primary flex items-center justify-center ${isCompact ? 'w-8 h-8' : 'w-9 h-9'}`}>
          <Users className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0">
          <p className={`font-black text-foreground ${isCompact ? 'text-sm' : 'text-base'}`}>{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl px-4 py-3 mb-3 flex items-center justify-between gap-2">
        <span className="font-mono font-black text-primary text-lg sm:text-xl tracking-[0.25em] truncate">{joinCode}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar código"
          className="flex items-center gap-1 text-[11px] font-semibold text-primary px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <button
        type="button"
        onClick={handleShare}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
      >
        {shared ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        {shared ? 'Enviado' : 'Compartir invitación'}
      </button>

      <a
        href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-green-500 text-white font-semibold text-xs hover:bg-green-600 transition-colors"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        Enviar por WhatsApp
      </a>

      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground py-1"
        >
          {skipLabel}
        </button>
      )}
    </div>
  );
}
