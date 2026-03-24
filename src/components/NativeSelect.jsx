import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, X } from 'lucide-react';
import { createFocusTrap } from '@/lib/focusTrap';

/**
 * NativeSelect — iOS-style bottom-sheet picker.
 * Props mirror a standard <select>:
 *   value, onChange, options: [{value, label}], placeholder, className, disabled
 */
export default function NativeSelect({ value, onChange, options = [], placeholder = '—', className = '', disabled = false }) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef(null);
  const selected = options.find(o => String(o.value) === String(value));

  useEffect(() => {
    if (!open || !sheetRef.current) return;
    const cleanup = createFocusTrap(sheetRef);
    return cleanup;
  }, [open]);

  const handleSelect = (val) => {
    onChange({ target: { value: val } });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={`Seleccionar ${placeholder}${selected ? `, opción actual: ${selected.label}` : ''}`}
        className={`flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setOpen(false)}
            />
            {/* Sheet */}
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-label={placeholder}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border pb-safe max-h-[70vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Handle + header */}
              <div className="flex-shrink-0">
                <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3" />
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <span className="text-sm font-semibold text-foreground">{placeholder}</span>
                  <button onClick={() => setOpen(false)} aria-label="Cerrar selector" className="p-1.5 rounded-lg bg-muted text-muted-foreground touch-target">
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Options list — scrollable */}
              <div className="overflow-y-auto overscroll-none hide-scrollbar">
                {options.map(opt => {
                  const isSelected = String(opt.value) === String(value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full flex items-center justify-between px-5 py-3.5 text-sm transition-colors active:bg-muted touch-target
                        ${isSelected ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                    </button>
                  );
                })}
                {/* Safe-area bottom padding inside scroll */}
                <div className="h-4" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}