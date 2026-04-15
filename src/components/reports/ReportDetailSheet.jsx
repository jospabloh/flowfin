import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import AmountDisplay from '@/components/AmountDisplay';

export default function ReportDetailSheet({ selectedDetail, detailLabel, detailTransactions, categories, persons, paymentMethods, onClose }) {
  return (
    <AnimatePresence>
      {selectedDetail && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border max-h-[85vh] overflow-y-auto pb-safe">
            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
              <div>
                <h3 className="font-bold text-foreground text-base">{detailLabel}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{detailTransactions.length} transacciones</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              {detailTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin transacciones</p>
              ) : detailTransactions.map(t => {
                const cat = categories.find(c => c.id === t.category_id);
                const person = persons.find(p => p.id === t.person_id);
                const method = paymentMethods.find(m => m.id === t.payment_method_id);
                return (
                  <div key={t.id} className="bg-muted rounded-2xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{t.description || 'Sin descripción'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{format(parseISO(t.date), 'dd MMM yyyy', { locale: es })}</p>
                      </div>
                      <AmountDisplay amount={t.amount} type={t.type} size="sm" />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {cat && <span className="text-[10px] bg-background px-2 py-1 rounded-full text-foreground">{cat.icon} {cat.name}</span>}
                      {person && <span className="text-[10px] bg-background px-2 py-1 rounded-full text-foreground">{person.name}</span>}
                      {method && <span className="text-[10px] bg-background px-2 py-1 rounded-full text-foreground">{method.name}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}