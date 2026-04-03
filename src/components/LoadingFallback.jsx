import { motion } from 'framer-motion';

export default function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Cargando contenido">
      <div className="flex flex-col items-center gap-6">
        {/* Animated logo skeleton */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-20 h-20 rounded-3xl overflow-hidden shadow-lg animate-pulse-ring bg-black"
        >
          <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/cd1c4478a_image.png" alt="FlowFin" className="w-full h-full object-cover" />
        </motion.div>

        {/* Content skeleton */}
        <div className="w-full max-w-sm space-y-4 px-6">
          {/* Header skeleton */}
          <div className="space-y-2">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="h-8 bg-muted rounded-xl w-3/4 mx-auto"
            />
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.1 }}
              className="h-4 bg-muted rounded-lg w-1/2 mx-auto"
            />
          </div>

          {/* Cards skeleton */}
          <div className="space-y-3 mt-6">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.2 + i * 0.1 }}
                className="h-24 bg-card border border-border rounded-2xl"
              />
            ))}
          </div>
        </div>

        {/* Loading text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-muted-foreground"
        >
          Cargando FlowFin...
        </motion.p>
      </div>
    </div>
  );
}