import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Converts natural language to a transaction draft using AI.
// DOES NOT SAVE ANYTHING. Only prepares a draft for user review.
// Resolves catalogs server-side for matching. Never trusts client-sent IDs.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const srEntities = base44.asServiceRole.entities;
    const userEntities = base44.entities;

    let memberships = await srEntities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) memberships = await srEntities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    if (!memberships.length) return Response.json({ error: 'forbidden' }, { status: 403 });

    const activeId = user.data?.family_id ?? user.data?.data?.family_id;
    const membership = memberships.find(m => m.family_id === activeId)
      ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
    const familyId = membership.family_id;

    const body = await req.json().catch(() => ({}));
    const { text } = body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return Response.json({ error: 'text is required' }, { status: 400 });
    }

    // Load catalogs server-side (user-scoped to respect RLS)
    const [persons, categories, subcategories, paymentMethods] = await Promise.all([
      userEntities.Person.filter({ family_id: familyId }),
      userEntities.Category.filter({ family_id: familyId }),
      userEntities.Subcategory.filter({ family_id: familyId }),
      userEntities.PaymentMethod.filter({ family_id: familyId }),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const selfPersonId = membership.person_id ?? null;
    const selfPerson = (persons || []).find(p => p.id === selfPersonId);

    const catalogsContext = JSON.stringify({
      persons: (persons || []).map(p => ({ id: p.id, name: p.name })),
      categories: (categories || []).map(c => ({ id: c.id, name: c.name, type: c.type })),
      subcategories: (subcategories || []).map(s => ({ id: s.id, name: s.name, category_id: s.category_id })),
      payment_methods: (paymentMethods || []).map(m => ({ id: m.id, name: m.name, type: m.type })),
      self_person: selfPerson ? { id: selfPerson.id, name: selfPerson.name } : null,
      today,
    });

    const prompt = `Eres un parser de transacciones financieras en español mexicano.

Analiza el siguiente texto y extrae los campos de una transacción.
Responde ÚNICAMENTE con un JSON válido, sin explicaciones.

CATÁLOGOS DISPONIBLES:
${catalogsContext}

REGLAS:
- Si el usuario no menciona fecha, usa today (${today}).
- "ayer" = un día antes de ${today}.
- Si no se menciona tipo, asume "expense" (gasto).
- Para person_id: si el usuario no menciona persona, usa self_person.id si existe.
- Busca coincidencias por nombre normalizado (sin acentos, minúsculas).
- confidence: 0.0 a 1.0 (qué tan seguro estás del borrador completo).
- missing_fields: lista de campos requeridos que faltan.

FORMATO DE RESPUESTA (JSON):
{
  "amount": number | null,
  "type": "expense" | "income",
  "date": "YYYY-MM-DD",
  "description": string,
  "category_id": string | null,
  "category_name": string | null,
  "subcategory_id": string | null,
  "subcategory_name": string | null,
  "payment_method_id": string | null,
  "payment_method_name": string | null,
  "person_id": string | null,
  "person_name": string | null,
  "confidence": number,
  "missing_fields": string[],
  "warnings": string[]
}

TEXTO DEL USUARIO:
"${text.replace(/"/g, '\\"')}"`;

    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          type: { type: 'string' },
          date: { type: 'string' },
          description: { type: 'string' },
          category_id: { type: 'string' },
          category_name: { type: 'string' },
          subcategory_id: { type: 'string' },
          subcategory_name: { type: 'string' },
          payment_method_id: { type: 'string' },
          payment_method_name: { type: 'string' },
          person_id: { type: 'string' },
          person_name: { type: 'string' },
          confidence: { type: 'number' },
          missing_fields: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    const draft = aiResponse ?? {};

    // Validate references exist in family catalogs (security: don't trust AI-returned IDs)
    const catIds = new Set((categories || []).map(c => c.id));
    const personIds = new Set((persons || []).map(p => p.id));
    const subIds = new Set((subcategories || []).map(s => s.id));
    const pmIds = new Set((paymentMethods || []).map(m => m.id));

    if (draft.category_id && !catIds.has(draft.category_id)) {
      draft.category_id = null;
      draft.category_name = null;
    }
    if (draft.person_id && !personIds.has(draft.person_id)) {
      draft.person_id = selfPersonId;
      draft.person_name = selfPerson?.name ?? null;
    }
    if (draft.subcategory_id && !subIds.has(draft.subcategory_id)) {
      draft.subcategory_id = null;
      draft.subcategory_name = null;
    }
    if (draft.payment_method_id && !pmIds.has(draft.payment_method_id)) {
      draft.payment_method_id = null;
      draft.payment_method_name = null;
    }

    return Response.json({ draft, is_draft: true });
  } catch (error) {
    console.error('finiaPrepareTransactionDraft error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});