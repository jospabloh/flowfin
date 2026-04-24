import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, MessageCircle } from 'lucide-react';

export default function FloatingActionButton({ isAssistantPage, handleNavClick }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  const handleNavAndClose = (path) => {
    handleNavClick(path);
    setIsExpanded(false);
  };

  if (isAssistantPage) return null;

  return (
    <div ref={containerRef} className="fixed right-4 z-50 flex items-center justify-center"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)', width: '64px', height: '152px' }}>

      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsExpanded(false)}
              aria-hidden="true"
            />

            {/* Chat Button — top position */}
            <motion.div
              initial={{ opacity: 0, scale: 0, y: 0, x: 0 }}
              animate={{ opacity: 1, scale: 1, y: -90, x: 0 }}
              exit={{ opacity: 0, scale: 0, y: 0, x: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250, delay: 0.05 }}
              className="absolute flex flex-col items-center gap-1">
              <button
                onClick={() => handleNavAndClose('/Assistant')}
                className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform hover:scale-110 touch-target"
                aria-label="Chat con asistente">
                <MessageCircle className="w-5 h-5" aria-hidden="true" />
              </button>
              <span className="text-[10px] font-semibold text-foreground bg-card/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap">Chat</span>
            </motion.div>

            {/* Add Transaction Button — middle position */}
            <motion.div
              initial={{ opacity: 0, scale: 0, y: 0, x: 0 }}
              animate={{ opacity: 1, scale: 1, y: -50, x: 0 }}
              exit={{ opacity: 0, scale: 0, y: 0, x: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250, delay: 0.05 }}
              className="absolute flex flex-col items-center gap-1">
              <button
                onClick={() => handleNavAndClose('/Capture')}
                className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform hover:scale-110 touch-target"
                aria-label="Agregar movimiento">
                <Plus className="w-5 h-5" aria-hidden="true" />
              </button>
              <span className="text-[10px] font-semibold text-foreground bg-card/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap">Agregar</span>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Button — always visible */}
      <motion.button
        initial={{ scale: 1 }}
        animate={{ scale: isExpanded ? 0 : 1, opacity: isExpanded ? 0 : 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform hover:scale-105 touch-target"
        aria-label="Abrir opciones flotantes"
        aria-expanded={isExpanded}>
        <Sparkles className="w-5 h-5" aria-hidden="true" />
      </motion.button>
    </div>
  );
}