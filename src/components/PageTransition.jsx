import { motion } from 'framer-motion';
import { getNavigationDirection } from '@/lib/navigationDirection';

export default function PageTransition({ children }) {
  const direction = getNavigationDirection();
  const x = direction === 'backward' ? '-100%' : '100%';

  return (
    <motion.div
      initial={{ x, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: direction === 'backward' ? '100%' : '-100%', opacity: 0 }}
      transition={{ type: 'tween', duration: 0.22, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}