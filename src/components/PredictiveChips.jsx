import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Shows up to 3 predictive chips based on what the user typically
 * captures at this day/time. Fades in only when data is available.
 * Clicking a chip fills in all the form fields at once.
 */
export default function PredictiveChips({ familyId, onSelect }) {
  const { data } = useQuery({
    queryKey: ['predictiveChips', familyId],
    queryFn: () => base44.functions.invoke('analytics', { action: 'getPredictiveChips', familyId }).then(r => r.data?.chips || []),
    enabled: !!familyId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: false,
  });

  const chips = data || [];
  if (chips.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="px-4 mt-3"
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs font-semibold text-foreground">Acceso rápido</p>
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {chips.map((chip, i) => (
            <button
              key={i}
              onClick={() => onSelect(chip)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-colors"
            >
              {chip.label}
              {chip.amount > 0 && (
                <span className="text-muted-foreground font-normal">
                  · ${Math.round(chip.amount).toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
