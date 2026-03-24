import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getNavigationDirection, subscribeDirection } from '@/lib/navigationDirection';

export default function PageTransition({ children }) {
  const [dir, setDir] = useState(getNavigationDirection);

  useEffect(() => subscribeDirection(setDir), []);

  const x = dir === 'backward' ? -24 : 24;

  return (
    <motion.div
      initial={{ opacity: 0, x }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -x }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  );
}