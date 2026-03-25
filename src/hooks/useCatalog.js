import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useCatalog(familyId) {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', familyId],
    queryFn: () => base44.entities.Category.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ['subcategories', familyId],
    queryFn: () => base44.entities.Subcategory.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const { data: persons = [] } = useQuery({
    queryKey: ['persons', familyId],
    queryFn: () => base44.entities.Person.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['paymentMethods', familyId],
    queryFn: () => base44.entities.PaymentMethod.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    categories: categories || [],
    subcategories: subcategories || [],
    persons: persons || [],
    paymentMethods: paymentMethods || [],
    isLoading: false,
  };
}