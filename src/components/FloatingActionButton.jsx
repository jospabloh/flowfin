import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, MessageCircle } from 'lucide-react';

export default function FloatingActionButton({ isAssistantPage, handleNavClick }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  // Load saved position on mount
  useEffect(() => {
    const saved = localStorage.getItem('fab-position');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that position is within reasonable bounds
        setPosition({
          x: Math.max(-60, Math.min(60, parsed.x || 0)),
          y: Math.max(-150, Math.min(150, parsed.y || 0)),
        });
      } catch (e) {
        setPosition({ x: 0, y: 0 });
      }
    }
  }, []);

  // Save position on change
  const handleDragEnd = (e, info) => {
    const x = Math.max(-60, Math.min(60, info.offset.x || 0));
    const y = Math.max(-150, Math.min(150, info.offset.y || 0));
    const newPos = { x, y };
    setPosition(newPos);
    localStorage.setItem('fab-position', JSON.stringify(newPos));
  };

  // Close when clicking outside
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isExpanded]);

  const handleNavAndClose = (path) => {
    handleNavClick(path);
    setIsExpanded(false);
  };

  if (isAssistantPage) return null;

  // Calculate secondary button positions dynamically based on viewport
  const getSecondaryPosition = (angle) => {
    const distance = 80;
    const radians = (angle * Math.PI) / 180;
    return {
      x: Math.cos(radians) * distance,
      y: Math.sin(radians) * distance,
    };
  };

  const chatPos = getSecondaryPosition(135); // Upper left
  const addPos = getSecondaryPosition(45);   // Upper right

  return (
    <>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 pointer-events-auto md:hidden"
            onClick={() => setIsExpanded(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <div
        ref={containerRef}
        className="md:hidden fixed z-50 pointer-events-none"
        style={{
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 76px + ${position.y}px)`,
          right: `calc(16px - ${position.x}px)`,
        }}>

        <AnimatePresence>
          {isExpanded && (
            <>
              {/* Chat Button — upper-left */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1, x: chatPos.x, y: chatPos.y }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', damping: 22, stiffness: 260 }}
                className="absolute flex flex-col items-center gap-1.5 pointer-events-auto z-50"
                onClick={(e) => { e.stopPropagation(); handleNavAndClose('/Assistant'); }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleNavAndClose('/Assistant'); }}
                  className="w-12 h-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow-xl shadow-secondary/40 active:scale-95 transition-transform hover:scale-110 touch-target ring-2 ring-secondary/40 ring-offset-2 ring-offset-background"
                  aria-label="Chat con asistente">
                  <MessageCircle className="w-5 h-5" aria-hidden="true" />
                </button>
                <span className="text-[10px] font-bold text-white bg-black/85 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap pointer-events-none border border-white/10">Asistente</span>
              </motion.div>

              {/* Add Transaction Button — upper-right */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1, x: addPos.x, y: addPos.y }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', damping: 22, stiffness: 260, delay: 0.04 }}
                className="absolute flex flex-col items-center gap-1.5 pointer-events-auto z-50"
                onClick={(e) => { e.stopPropagation(); handleNavAndClose('/Capture'); }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleNavAndClose('/Capture'); }}
                  className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/40 active:scale-95 transition-transform hover:scale-110 touch-target ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
                  aria-label="Agregar movimiento">
                  <Plus className="w-5 h-5" aria-hidden="true" />
                </button>
                <span className="text-[10px] font-bold text-white bg-black/85 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap pointer-events-none border border-white/10">Agregar</span>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Button — arrastrable */}
        <motion.button
          ref={buttonRef}
          drag
          dragConstraints={{
            top: -150,
            left: -60,
            right: 60,
            bottom: 150,
          }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          initial={{ scale: 1 }}
          animate={{ scale: isExpanded ? 0.85 : 1, opacity: isExpanded ? 0.4 : 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute w-[52px] h-[52px] rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/40 active:scale-95 transition-transform hover:scale-105 touch-target pointer-events-auto ring-2 ring-primary/30 ring-offset-2 ring-offset-background cursor-grab active:cursor-grabbing"
          aria-label="Abrir opciones flotantes"
          aria-expanded={isExpanded}>
          <motion.div animate={{ rotate: isExpanded ? 20 : 0 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}>
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          </motion.div>
        </motion.button>
      </div>
    </>
  );
}