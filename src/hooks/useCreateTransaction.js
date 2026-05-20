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
  const { familyId } = useFamily();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
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
