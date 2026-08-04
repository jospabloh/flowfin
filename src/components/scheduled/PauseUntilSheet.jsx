import { useState, useEffect } from 'react';
import { X, PauseCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomSheetStyle } from '@/hooks/useBottomSheetStyle';

function nextMonthValue() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(value) {
  if (!/^\d{4}-\d{2}$/.test(value || '')) return '';
  const [y, m] = value.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

// Replaces the old globalThis.prompt() — same two options (1 mes / fecha
// elegida), but as a proper sheet consistent with the rest of the app instead
// of a bare browser dialog with no validation.
export default function PauseUntilSheet({ item, onConfirm, onClose }) {
  const sheetStyle = useBottomSheetStyle(0.7);
  const [mode, setMode] = useState('one_month'); // 'one_month' | 'custom'
  const [customMonth, setCustomMonth] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (item) { setMode('one_month'); setCustomMonth(''); setReason(''); }
  }, [item]);

  if (!item) return null;

  const targetMonth = mode === 'one_month' ? nextMonthValue() : customMonth;
  const canConfirm = mode === 'one_month' || /^\d{4}-\d{2}$/.test(customMonth);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(targetMonth, reason.trim() || (mode === 'one_month' ? 'Pausa 1 mes' : 'Pausa temporal'));
  };

  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border flex flex-col"
            style={sheetStyle}
          >
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3 flex-shrink-0" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <PauseCircle className="w-4 h-4 text-muted-foreground" /> Pausar “{item.name}”
              </p>
              <button onClick={onClose} className="p-1.5 rounded-lg bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Mientras esté pausado no se te va a pedir que lo marques como pagado, y vuelve a aparecer normal apenas termine la pausa.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode('one_month')}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all min-h-[44px] ${mode === 'one_month' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:bg-muted/70'}`}>
                  1 mes <span className="block font-normal opacity-80 normal-case">{formatMonthLabel(nextMonthValue())}</span>
                </button>
                <button onClick={() => setMode('custom')}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all min-h-[44px] ${mode === 'custom' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:bg-muted/70'}`}>
                  Elegir mes…
                </button>
              </div>
              {mode === 'custom' && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pausar hasta</p>
                  <input type="month" value={customMonth} onChange={e => setCustomMonth(e.target.value)}
                    onClick={e => e.target.showPicker?.()}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer" />
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Motivo (opcional)</p>
                <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder={mode === 'one_month' ? 'Pausa 1 mes' : 'Pausa temporal'}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <button onClick={handleConfirm} disabled={!canConfirm}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 active:opacity-80 transition-opacity min-h-[48px]">
                {canConfirm ? `Pausar hasta ${formatMonthLabel(targetMonth)}` : 'Elegí un mes'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
