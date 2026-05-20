/**
 * ReceiptScanButton.jsx
 * Camera icon button + hidden file input + client-side compression.
 * Calls the Base44 scanReceipt function and surfaces the result via onScanComplete.
 *
 * Localization strings follow the TEMPLATES['es-MX'] / ['en-US'] pattern from
 * AssistantWelcome.jsx:8-47.
 */

import { useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { ImagePlus, Loader2, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { compressReceiptImage } from '@/lib/receiptCompression';
import { useFamily } from '@/lib/FamilyContext';
import { useToast } from '@/components/ui/use-toast';
import { useReceiptScanQuota } from '@/hooks/useReceiptScanQuota';
import UpgradePlansModal from '@/components/UpgradePlansModal';

// ---------------------------------------------------------------------------
// Bilingual strings (mirrors AssistantWelcome TEMPLATES shape)
// ---------------------------------------------------------------------------
const STRINGS = {
  'es-MX': {
    scanButtonTooltip: 'Escanear ticket',
    scanningStatus: 'Leyendo ticket…',
    scanFailed: 'No pude leer el ticket. Inténtalo de nuevo.',
    dailyCapHit: 'Alcanzaste el límite de escaneos de hoy.',
    fileTooLarge: 'La imagen es muy grande. Máximo 8 MB.',
    unsupportedType: 'Formato no soportado. Usa JPEG, PNG, WebP o HEIC.',
  },
  'en-US': {
    scanButtonTooltip: 'Scan receipt',
    scanningStatus: 'Reading receipt…',
    scanFailed: "Couldn't read that receipt. Try again.",
    dailyCapHit: "You've hit today's scan limit.",
    fileTooLarge: 'Image is too large. Max 8 MB.',
    unsupportedType: 'Unsupported format. Use JPEG, PNG, WebP, or HEIC.',
  },
};

function getStrings(locale) {
  if (!locale) return STRINGS['es-MX'];
  return locale.startsWith('en') ? STRINGS['en-US'] : STRINGS['es-MX'];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * @param {{ onScanComplete: (parsed: object) => void, disabled?: boolean, locale?: string }} props
 */
const ReceiptScanButton = forwardRef(function ReceiptScanButton(
  { onScanComplete, disabled = false, locale = 'es-MX' },
  ref
) {
  const fileRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { toast } = useToast();
  const { familyId, membership } = useFamily();
  const personId = membership?.person_id || '';
  const strings = getStrings(locale);
  const { exceeded: quotaExceeded } = useReceiptScanQuota();

  const processFile = useCallback(async (file) => {
    if (!file) return;
    setScanning(true);

    let compressed;
    try {
      compressed = await compressReceiptImage(file);
    } catch (err) {
      setScanning(false);
      if (err.code === 'file_too_large') {
        toast({ title: strings.fileTooLarge, variant: 'destructive' });
      } else if (err.code === 'unsupported_mime_type') {
        toast({ title: strings.unsupportedType, variant: 'destructive' });
      } else {
        toast({ title: strings.scanFailed, variant: 'destructive' });
      }
      return;
    }

    let result;
    try {
      // TODO: confirm secret name with Base44 admin (currently process.env.ANTHROPIC_API_KEY in scanReceipt/entry.ts)
      result = await base44.functions.invoke('scanReceipt', {
        imageB64: compressed.b64,
        mediaType: compressed.mediaType,
        familyId,
        personId,
        locale,
      });
    } catch (err) {
      setScanning(false);
      const serverError = err?.data?.error || err?.message || '';
      if (serverError === 'daily_cap_exceeded') {
        toast({ title: strings.dailyCapHit, variant: 'destructive' });
      } else {
        toast({ title: strings.scanFailed, variant: 'destructive' });
      }
      return;
    }

    setScanning(false);

    // Unwrap Base44 function response envelope (may be { data: {...} } or the object directly).
    const parsed = result?.data ?? result;

    if (parsed?.error) {
      toast({ title: strings.scanFailed, variant: 'destructive' });
      return;
    }

    // Attach the thumbnail blobUrl for the preview bubble.
    onScanComplete({ ...parsed, thumbnailUrl: compressed.blobUrl });
  }, [familyId, personId, locale, onScanComplete, strings, toast]);

  // Expose processFile so parent can trigger a scan from a pasted image.
  useImperativeHandle(ref, () => ({ processFile, isScanning: () => scanning }), [processFile, scanning]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-selected if the user retries.
    e.target.value = '';
    await processFile(file);
  };

  const handleButtonClick = () => {
    if (scanning || disabled) return;
    if (quotaExceeded) {
      setShowUpgrade(true);
      return;
    }
    fileRef.current?.click();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={scanning || disabled}
        aria-label={strings.scanButtonTooltip}
        title={strings.scanButtonTooltip}
        className={`p-3 rounded-xl transition-all ${
          scanning
            ? 'bg-primary/10 text-primary'
            : quotaExceeded
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground hover:text-foreground'
        } disabled:opacity-60`}
      >
        {scanning
          ? <Loader2 className="w-5 h-5 animate-spin" />
          : quotaExceeded
            ? <Lock className="w-5 h-5" />
            : <ImagePlus className="w-5 h-5" />}
      </button>

      {/* Hidden file input — same pattern as Capture.jsx:460 */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <UpgradePlansModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>
  );
});

export default ReceiptScanButton;