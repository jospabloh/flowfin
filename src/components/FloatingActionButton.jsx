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
    <div ref={containerRef} className="fixed right-4 z-50 md:hidden flex items-center justify-center"
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

            {/* Chat Button — top-left position */}
            <motion.button
              initial={{ opacity: 0, scale: 0, y: 0, x: 0 }}
              animate={{ opacity: 1, scale: 1, y: -64, x: -48 }}
              exit={{ opacity: 0, scale: 0, y: 0, x: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300, delay: 0.05 }}
              onClick={() => handleNavAndClose('/Assistant')}
              className="absolute w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform hover:scale-110 touch-target"
              aria-label="Chat con asistente">
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
            </motion.button>

            {/* Add Transaction Button — top-right position */}
            <motion.button
              initial={{ opacity: 0, scale: 0, y: 0, x: 0 }}
              animate={{ opacity: 1, scale: 1, y: -64, x: 48 }}
              exit={{ opacity: 0, scale: 0, y: 0, x: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300, delay: 0.05 }}
              onClick={() => handleNavAndClose('/Capture')}
              className="absolute w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform hover:scale-110 touch-target"
              aria-label="Agregar movimiento">
              <Plus className="w-5 h-5" aria-hidden="true" />
            </motion.button>
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
