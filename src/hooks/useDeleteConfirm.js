import { useState, useCallback, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Replaces native confirm() with a styled Radix AlertDialog.
 *
 * Usage:
 *   const { confirmDelete, ConfirmDialog } = useDeleteConfirm();
 *   // render <ConfirmDialog /> once inside the component JSX
 *   const ok = await confirmDelete('¿Eliminar este elemento?');
 *   if (ok) handleDelete();
 */
export function useDeleteConfirm() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const resolveRef = useRef(null);

  const confirmDelete = useCallback((msg = '¿Eliminar este elemento? Esta acción no se puede deshacer.') => {
    setMessage(msg);
    setOpen(true);
    return new Promise((resolve) => { resolveRef.current = resolve; });
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(false);
  }, []);

  const ConfirmDialog = useCallback(() => (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ), [open, message, handleConfirm, handleCancel]);

  return { confirmDelete, ConfirmDialog };
}
