import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { resolveAccess } from '../_txAggregateHelper.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let access;
    try {
      access = await resolveAccess(base44, undefined);
    } catch (e: any) {
      if (e.httpStatus === 401 || e.code === 'not_linked') {
        return Response.json(
          {
            error: 'not_linked',
            message:
              'Tu sesión de WhatsApp no está vinculada. Abre FlowFin y toca el botón de WhatsApp para reconectarte.',
          },
          { status: 401 },
        );
      }
      throw e;
    }

    const { familyId } = access;
    const entities = base44.asServiceRole.entities;

    const [personsArr, categoriesArr, subcategoriesArr, paymentMethodsArr] = await Promise.all([
      entities.Person.filter({ family_id: familyId }),
      entities.Category.filter({ family_id: familyId }),
      entities.Subcategory.filter({ family_id: familyId }),
      entities.PaymentMethod.filter({ family_id: familyId }),
    ]);

    return Response.json({
      family_id: familyId,
      persons: (personsArr || []).map((p: any) => ({ id: p.id, name: p.name })),
      categories: (categoriesArr || []).map((c: any) => ({ id: c.id, name: c.name, type: c.type, icon: c.icon })),
      subcategories: (subcategoriesArr || []).map((s: any) => ({ id: s.id, name: s.name, category_id: s.category_id })),
      payment_methods: (paymentMethodsArr || []).map((m: any) => ({ id: m.id, name: m.name, type: m.type })),
    });
  } catch (error: any) {
    console.error('agentGetCatalogs error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: error.httpStatus || 500 });
  }
});
