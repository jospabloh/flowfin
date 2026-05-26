import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const THINKING_MESSAGES = [
  'Finia está pensando…',
  'Analizando tu información…',
  'Revisando tus datos…',
  'Casi listo…',
];

export default function FiniaTypingIndicator() {
  const [msgIdx, setMsgIdx] = useState(0);

  // Cycle through messages so the user knows it's still working
  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIdx(i => (i + 1) % THINKING_MESSAGES.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex gap-2.5 items-end">
      {/* Avatar with pulse */}
      <div className="relative w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm shadow-sm ring-1 ring-primary/10">
        <motion.span
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          💚
        </motion.span>
        <motion.span
          className="absolute inset-0 rounded-full bg-primary/20"
          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
        />
      </div>

      {/* Bubble */}
      <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm flex items-center gap-2.5">
        {/* Thinking text */}
        <motion.span
          key={msgIdx}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="text-xs text-muted-foreground font-medium"
        >
          {THINKING_MESSAGES[msgIdx]}
        </motion.span>

        {/* Bouncing dots */}
        <div className="flex gap-1 items-center">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{ duration: 1.1, delay: i * 0.18, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}