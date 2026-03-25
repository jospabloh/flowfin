import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useCatalog(familyId) {
  const { data: categories = [], isLoading: loadingCats, error: catError } = useQuery({
    queryKey: ['categories', familyId],
    queryFn: () => base44.entities.Category.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: subcategories = [], isLoading: loadingSubs, error: subError } = useQuery({
    queryKey: ['subcategories', familyId],
    queryFn: () => base44.entities.Subcategory.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: persons = [], isLoading: loadingPersons, error: persError } = useQuery({
    queryKey: ['persons', familyId],
    queryFn: () => base44.entities.Person.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: paymentMethods = [], isLoading: loadingMethods, error: payError } = useQuery({
    queryKey: ['paymentMethods', familyId],
    queryFn: () => base44.entities.PaymentMethod.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (catError) console.error('useCatalog categories error:', catError);
  if (subError) console.error('useCatalog subcategories error:', subError);
  if (persError) console.error('useCatalog persons error:', persError);
  if (payError) console.error('useCatalog paymentMethods error:', payError);

  return {
    categories: categories || [],
    subcategories: subcategories || [],
    persons: persons || [],
    paymentMethods: paymentMethods || [],
    isLoading: loadingCats || loadingSubs || loadingPersons || loadingMethods,
  };
}