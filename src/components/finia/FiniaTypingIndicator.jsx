import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const THINKING_MESSAGES = [
  'Pensando',
  'Analizando tu información',
  'Revisando tus datos',
  'Procesando',
  'Casi listo',
];

export default function FiniaTypingIndicator() {
  const [msgIdx, setMsgIdx] = useState(0);

  // Cycle messages so the user knows it's still working
  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIdx(i => (i + 1) % THINKING_MESSAGES.length);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex gap-2.5 items-center py-1">
      {/* Animated gradient orb avatar */}
      <div className="relative w-7 h-7 rounded-full flex-shrink-0 overflow-hidden">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--primary)))',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-[2px] rounded-full bg-background flex items-center justify-center text-sm">
          💚
        </div>
      </div>

      {/* Shimmer text — gradient sweeping across, like Gemini/Claude */}
      <div className="relative">
        <motion.span
          key={msgIdx}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.3 }}
          className="text-sm font-medium bg-clip-text text-transparent"
          style={{
            backgroundImage:
              'linear-gradient(90deg, hsl(var(--muted-foreground) / 0.4) 0%, hsl(var(--foreground)) 50%, hsl(var(--muted-foreground) / 0.4) 100%)',
            backgroundSize: '200% 100%',
            animation: 'finia-shimmer 1.8s linear infinite',
          }}
        >
          {THINKING_MESSAGES[msgIdx]}
        </motion.span>
      </div>

      <style>{`
        @keyframes finia-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}