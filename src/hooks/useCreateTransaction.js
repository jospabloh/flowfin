import { useMutation, useQueryClient } from '@tanstack/react-query';
import { guardedCreate } from '@/lib/guardedWrite';
import { useFamily } from '@/lib/FamilyContext';
import { useToast } from '@/components/ui/use-toast';

/**
 * Shared mutation for creating a Transaction.
 * Centralises cache invalidation and error toast so Capture.jsx and
 * QuickCaptureSheet send the exact same payload contract.
 */
export function useCreateTransaction({ onError } = {}) {
  const queryClient = useQueryClient();
  const { familyId, isReadOnly } = useFamily();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data) => {
      // Fast client-side check for instant feedback — guardedEntityWrite
      // (base44/functions/guardedEntityWrite) re-checks this same
      // billing_status gate server-side before writing, so this isn't the
      // only thing standing between a read-only family and a write anymore.
      if (isReadOnly) {
        return Promise.reject(new Error('Tu cuenta está en modo solo lectura; no puedes registrar movimientos ahora.'));
      }
      return guardedCreate('Transaction', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions_dashboard', familyId] });
    },
    onError: (err) => {
      toast({
        title: 'Error al guardar',
        description: err?.message || 'No se pudo guardar el movimiento',
        variant: 'destructive',
      });
      onError?.(err);
    },
  });
}
