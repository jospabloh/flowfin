import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RentalPropertyFormSheet({ show, editingProp, propForm, setPropForm, isSaving, onSave, onClose }) {
  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => { if (!isSaving) onClose(); }} />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-[51] bg-card rounded-t-3xl border-t border-border flex flex-col"
            style={{ maxHeight: '90vh', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
          >
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-3 flex-shrink-0" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
              <h3 className="font-bold text-foreground">{editingProp ? 'Editar Propiedad' : 'Nueva Propiedad'}</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-none hide-scrollbar flex-1 px-5 py-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nombre de la propiedad *</p>
                <input placeholder="Ej: Depto Norte, Casa Toche" value={propForm.name}
                  onChange={e => setPropForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Inquilino</p>
                <input placeholder="Nombre del inquilino" value={propForm.tenant_name}
                  onChange={e => setPropForm(f => ({ ...f, tenant_name: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Dirección</p>
                <input placeholder="Calle, colonia, ciudad" value={propForm.address}
                  onChange={e => setPropForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Renta base mensual *</p>
                  <input type="number" inputMode="decimal" placeholder="0.00" value={propForm.base_rent}
                    onChange={e => setPropForm(f => ({ ...f, base_rent: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Día de cobro (1–28)</p>
                  <input type="number" min="1" max="28" placeholder="Ej: 5" value={propForm.payment_day}
                    onChange={e => setPropForm(f => ({ ...f, payment_day: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notas</p>
                <input placeholder="Observaciones adicionales" value={propForm.notes}
                  onChange={e => setPropForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <button onClick={onSave} disabled={!propForm.name.trim() || !propForm.base_rent || isSaving}
                className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 active:opacity-80 min-h-[48px] flex items-center justify-center gap-2">
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : editingProp ? 'Guardar cambios' : 'Crear Propiedad'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}