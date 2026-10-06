import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useDragControls } from 'framer-motion';
import { Sparkles, Plus, MessageCircle } from 'lucide-react';
import QuickCaptureSheet from '@/components/QuickCaptureSheet';

const BTN = 52;
const EDGE = 12;

// Quick Capture is feature-flagged so prod can roll out safely. Set
// VITE_QUICK_CAPTURE_ENABLED=true in the build env to enable; otherwise the
// FAB falls back to navigating to /Capture as before.
const QUICK_CAPTURE_ENABLED = import.meta.env.VITE_QUICK_CAPTURE_ENABLED === 'true';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function navPad() {
  return globalThis.innerWidth < 768 ? 80 : EDGE;
}

function getBounds() {
  return {
    minX: EDGE,
    maxX: globalThis.innerWidth - BTN - EDGE,
    minY: EDGE,
    maxY: globalThis.innerHeight - BTN - navPad(),
  };
}

// The corner theme switcher owns the bottom-right corner (index.css:
// --theme-switcher-bottom is 5.5rem on phones, 1rem from 768px up; the control
// is up to 44px tall). The FAB's default spot stacks ABOVE it instead of on top
// of it — a draggable control can always be moved, but nobody should have to.
const SWITCHER_SIZE = 44;
const SWITCHER_GAP = 12;

function getDefaultPos() {
  const b = getBounds();
  const switcherBottom = globalThis.innerWidth < 768 ? 88 : 16;
  const y = globalThis.innerHeight - BTN - (switcherBottom + SWITCHER_SIZE + SWITCHER_GAP);
  return { x: b.maxX, y: clamp(y, b.minY, b.maxY) };
}

function loadPos() {
  try {
    const raw = localStorage.getItem('fab-pos-v2');
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p.x !== 'number' || typeof p.y !== 'number') return null;
    const b = getBounds();
    return { x: clamp(p.x, b.minX, b.maxX), y: clamp(p.y, b.minY, b.maxY) };
  } catch {
    return null;
  }
}

function getSecondaryInfo(fabX, fabY) {
  const DIST = 76;
  const vw = globalThis.innerWidth;
  const vh = globalThis.innerHeight;
  const onRight = fabX > vw * 0.55;
  const onBottom = fabY > vh * 0.55;
  // angle: 0=right, 90=up (screen y inverted)
  const a1 = onRight ? (onBottom ? 135 : 225) : (onBottom ? 45 : 315);
  const a2 = onBottom ? 90 : 270;
  const toOff = (deg) => ({
    x: Math.cos((deg * Math.PI) / 180) * DIST,
    y: -Math.sin((deg * Math.PI) / 180) * DIST,
  });
  return {
    off1: toOff(a1),
    off2: toOff(a2),
    labelsAbove: onBottom,
  };
}

export default function FloatingActionButton({ isAssistantPage, handleNavClick }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const containerRef = useRef(null);
  const dragControls = useDragControls();
  const xMV = useMotionValue(0);
  const yMV = useMotionValue(0);
  const wasDragging = useRef(false);

  useEffect(() => {
    const p = loadPos() ?? getDefaultPos();
    setPos(p);
    xMV.set(p.x);
    yMV.set(p.y);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const b = getBounds();
      const x = clamp(xMV.get(), b.minX, b.maxX);
      const y = clamp(yMV.get(), b.minY, b.maxY);
      xMV.set(x);
      yMV.set(y);
      setPos({ x, y });
    };
    globalThis.addEventListener('resize', onResize);
    return () => globalThis.removeEventListener('resize', onResize);
  }, [xMV, yMV]);

  const handleDragEnd = useCallback((_, info) => {
    if (Math.abs(info.offset.x) > 4 || Math.abs(info.offset.y) > 4) {
      wasDragging.current = true;
      // Reset after click event window so flag doesn't persist if no click fires
      setTimeout(() => { wasDragging.current = false; }, 0);
    }
    const b = getBounds();
    const x = clamp(xMV.get(), b.minX, b.maxX);
    const y = clamp(yMV.get(), b.minY, b.maxY);
    xMV.set(x);
    yMV.set(y);
    const newPos = { x, y };
    setPos(newPos);
    localStorage.setItem('fab-pos-v2', JSON.stringify(newPos));
  }, [xMV, yMV]);

  useEffect(() => {
    if (!isExpanded) return;
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [isExpanded]);

  const handleButtonClick = () => {
    if (wasDragging.current) {
      wasDragging.current = false;
      return;
    }
    setIsExpanded((v) => !v);
  };

  const handleNavAndClose = (path) => {
    handleNavClick(path);
    setIsExpanded(false);
  };

  const handleAddPress = () => {
    setIsExpanded(false);
    if (QUICK_CAPTURE_ENABLED) {
      setQuickCaptureOpen(true);
    } else {
      handleNavClick('/Capture');
    }
  };

  if (isAssistantPage || !pos) return null;

  const b = getBounds();
  const { off1, off2, labelsAbove } = getSecondaryInfo(pos.x, pos.y);
  const labelClass = `text-[10px] font-bold text-white bg-black/85 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap pointer-events-none border border-white/10`;
  const colDir = labelsAbove ? 'flex-col-reverse' : 'flex-col';

  return (
    <>
      <QuickCaptureSheet
        open={quickCaptureOpen}
        onClose={() => setQuickCaptureOpen(false)}
        onAdvancedMode={() => handleNavClick('/Capture')}
      />
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40"
            onClick={() => setIsExpanded(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <motion.div
        ref={containerRef}
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={{ left: b.minX, top: b.minY, right: b.maxX, bottom: b.maxY }}
        onDragEnd={handleDragEnd}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          x: xMV,
          y: yMV,
          width: BTN,
          height: BTN,
          zIndex: 50,
        }}
        className="pointer-events-none"
      >
        <AnimatePresence>
          {isExpanded && (
            <>
              <motion.div
                key="chat"
                initial={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
                animate={{ opacity: 1, scale: 1, x: off1.x, y: off1.y }}
                exit={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
                transition={{ type: 'spring', damping: 22, stiffness: 260 }}
                className={`absolute top-0 left-0 flex ${colDir} items-center gap-1.5 pointer-events-auto`}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); handleNavAndClose('/Assistant'); }}
                  className="w-12 h-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow-xl shadow-secondary/40 active:scale-95 transition-transform hover:scale-110 ring-2 ring-secondary/40 ring-offset-2 ring-offset-background"
                  aria-label="Chat con asistente"
                >
                  <MessageCircle className="w-5 h-5" aria-hidden="true" />
                </button>
                <span className={labelClass}>Asistente</span>
              </motion.div>

              <motion.div
                key="add"
                initial={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
                animate={{ opacity: 1, scale: 1, x: off2.x, y: off2.y }}
                exit={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
                transition={{ type: 'spring', damping: 22, stiffness: 260, delay: 0.04 }}
                className={`absolute top-0 left-0 flex ${colDir} items-center gap-1.5 pointer-events-auto`}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddPress(); }}
                  className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/40 active:scale-95 transition-transform hover:scale-110 ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
                  aria-label="Agregar movimiento"
                >
                  <Plus className="w-5 h-5" aria-hidden="true" />
                </button>
                <span className={labelClass}>Agregar</span>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <motion.button
          animate={{ scale: isExpanded ? 0.9 : 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          onPointerDown={(e) => dragControls.start(e)}
          onClick={handleButtonClick}
          style={{ touchAction: 'none' }}
          className="absolute inset-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/40 active:scale-95 hover:scale-105 pointer-events-auto ring-2 ring-primary/30 ring-offset-2 ring-offset-background cursor-grab active:cursor-grabbing"
          aria-label="Abrir opciones flotantes"
          aria-expanded={isExpanded}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 20 : 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          </motion.div>
        </motion.button>
      </motion.div>
    </>
  );
}
