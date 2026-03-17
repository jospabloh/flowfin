import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useCatalog(familyId) {
  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ['categories', familyId],
    queryFn: () => base44.entities.Category.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: subcategories = [], isLoading: loadingSubs } = useQuery({
    queryKey: ['subcategories', familyId],
    queryFn: () => base44.entities.Subcategory.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: persons = [], isLoading: loadingPersons } = useQuery({
    queryKey: ['persons', familyId],
    queryFn: () => base44.entities.Person.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: paymentMethods = [], isLoading: loadingMethods } = useQuery({
    queryKey: ['paymentMethods', familyId],
    queryFn: () => base44.entities.PaymentMethod.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    categories,
    subcategories,
    persons,
    paymentMethods,
    isLoading: loadingCats || loadingSubs || loadingPersons || loadingMethods,
  };
}