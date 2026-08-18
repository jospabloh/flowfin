import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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
      // Client-side mirror of validateMutationAllowed's read-only-mode gate.
      // Not the whole fix — Transaction's RLS can't itself check
      // Family.billing_status (no join support), so this only blocks the
      // UI's own paths, not a direct SDK call. Real server-side enforcement
      // needs a Safe-function conversion for Transaction writes, tracked as
      // a separate initiative in CLAUDE.md (module 3, part 2).
      if (isReadOnly) {
        return Promise.reject(new Error('Tu cuenta está en modo solo lectura; no puedes registrar movimientos ahora.'));
      }
      return base44.entities.Transaction.create(data);
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
