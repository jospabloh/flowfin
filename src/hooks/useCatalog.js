import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { defaultCategories, defaultSubcategoriesByCategory, defaultPaymentMethods } from '@/lib/seedData';

async function ensureSeeded() {
  const [cats, methods] = await Promise.all([
    base44.entities.Category.list(),
    base44.entities.PaymentMethod.list(),
  ]);

  if (cats.length === 0) {
    const created = await base44.entities.Category.bulkCreate(defaultCategories);
    const subPromises = created.map(cat => {
      const subs = defaultSubcategoriesByCategory[cat.name];
      if (!subs) return Promise.resolve([]);
      return base44.entities.Subcategory.bulkCreate(subs.map(s => ({ ...s, category_id: cat.id })));
    });
    await Promise.all(subPromises);
  }

  if (methods.length === 0) {
    await base44.entities.PaymentMethod.bulkCreate(defaultPaymentMethods);
  }
}

let seeded = false;

export function useCatalog() {
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      if (!seeded) { await ensureSeeded(); seeded = true; }
      return base44.entities.Category.list('name');
    },
    staleTime: 5 * 60 * 1000,
  });

  const subcategories = useQuery({
    queryKey: ['subcategories'],
    queryFn: () => base44.entities.Subcategory.list('name'),
    staleTime: 5 * 60 * 1000,
  });

  const persons = useQuery({
    queryKey: ['persons'],
    queryFn: () => base44.entities.Person.list('name'),
    staleTime: 5 * 60 * 1000,
  });

  const paymentMethods = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: () => base44.entities.PaymentMethod.list('name'),
    staleTime: 5 * 60 * 1000,
  });

  return {
    categories: categories.data || [],
    subcategories: subcategories.data || [],
    persons: persons.data || [],
    paymentMethods: paymentMethods.data || [],
    isLoading: categories.isLoading || subcategories.isLoading || persons.isLoading || paymentMethods.isLoading,
  };
}