import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Converts natural language (and/or an attached receipt photo) into a
// SHARED-EXPENSE draft: one purchase, paid unevenly by two or more people in
// the same family (e.g. "pagué 100 en la cena, 80 fueron míos y 20 de
// Silvia"). Distinct from finiaPrepareTransactionDraft (single person, single
// amount) and from Trip's is_split/split_with_person_ids (always an even
// split). DOES NOT SAVE ANYTHING — see finiaConfirmSplitExpense for that.
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
    const file_urls = Array.isArray(body.file_urls) ? body.file_urls.filter(u => typeof u === 'string' && u) : [];
    const hasText = typeof text === 'string' && text.trim().length > 0;
    if (!hasText && !file_urls.length) {
      return Response.json({ error: 'text or file_urls is required' }, { status: 400 });
    }

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

    const imageInstructions = file_urls.length
      ? `\nSe adjuntó una imagen (recibo/ticket). Analiza la imagen para extraer el monto total, la fecha y el comercio/concepto. El texto del usuario indica cómo se reparte entre las personas.\n`
      : '';

    const prompt = `Eres un parser de GASTOS COMPARTIDOS (una sola compra, pagada de forma desigual entre 2 o más personas de la misma familia) en español mexicano.

Ejemplo: "pagué 100 en la cena, 80 fueron míos y 20 de Silvia" → un gasto de $100 total, repartido en $80 (usuario) + $20 (Silvia).
Si el usuario NO da montos por persona y solo dice "dividido entre X personas" o "a la mitad", reparte el total en partes IGUALES entre las personas mencionadas (incluyendo al usuario si no dice lo contrario).

Analiza ${file_urls.length ? 'la imagen adjunta y el' : 'el'} siguiente texto y extrae los campos de un gasto compartido.
Responde ÚNICAMENTE con un JSON válido, sin explicaciones.
${imageInstructions}
CATÁLOGOS DISPONIBLES:
${catalogsContext}

REGLAS:
- amount_total: monto total de la compra. Requerido.
- Los montos de "splits" DEBEN sumar exactamente amount_total (ajusta centavos de redondeo en el último split si es necesario al dividir parejo).
- Cada split necesita person_id (o person_name si no hay match exacto — se resuelve por nombre después).
- Si el usuario no menciona fecha, usa today (${today}).
- INFERENCIA DE CATEGORÍA: mismo criterio semántico que para transacciones normales — elige siempre la más cercana del catálogo, nunca null si alguna aplica.
- type: "expense" (lo normal) o "income" si describe un ingreso compartido (raro, pero soportado).
- confidence: 0.0 a 1.0.
- missing_fields: campos requeridos que faltan (amount_total, o "splits" si no se pudo repartir con confianza).
- warnings: avisos relevantes (ej. "no especificaste montos, dividí parejo").

FORMATO DE RESPUESTA (JSON):
{
  "amount_total": number | null,
  "type": "expense" | "income",
  "date": "YYYY-MM-DD",
  "description": string,
  "category_id": string | null,
  "category_name": string | null,
  "subcategory_id": string | null,
  "subcategory_name": string | null,
  "payment_method_id": string | null,
  "payment_method_name": string | null,
  "splits": [
    { "person_id": string | null, "person_name": string | null, "amount": number }
  ],
  "confidence": number,
  "missing_fields": string[],
  "warnings": string[]
}

TEXTO DEL USUARIO:
"${hasText ? text.replace(/"/g, '\\"') : '(sin texto — usa solo la imagen adjunta)'}"`;

    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      ...(file_urls.length ? { file_urls } : {}),
      response_json_schema: {
        type: 'object',
        properties: {
          amount_total: { type: 'number' },
          type: { type: 'string' },
          date: { type: 'string' },
          description: { type: 'string' },
          category_id: { type: 'string' },
          category_name: { type: 'string' },
          subcategory_id: { type: 'string' },
          subcategory_name: { type: 'string' },
          payment_method_id: { type: 'string' },
          payment_method_name: { type: 'string' },
          splits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                person_id: { type: 'string' },
                person_name: { type: 'string' },
                amount: { type: 'number' },
              },
            },
          },
          confidence: { type: 'number' },
          missing_fields: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    const draft = aiResponse ?? {};

    const norm = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const fuzzyFind = (list, name) => {
      if (!name) return null;
      const n = norm(name);
      let match = list.find(x => norm(x.name) === n);
      if (match) return match;
      match = list.find(x => norm(x.name).includes(n) || n.includes(norm(x.name)));
      if (match) return match;
      const words = n.split(/\s+/).filter(w => w.length > 2);
      match = list.find(x => words.some(w => norm(x.name).includes(w)));
      return match ?? null;
    };

    const catIds = new Set((categories || []).map(c => c.id));
    const personIds = new Set((persons || []).map(p => p.id));
    const subIds = new Set((subcategories || []).map(s => s.id));
    const pmIds = new Set((paymentMethods || []).map(m => m.id));

    if (draft.category_id && !catIds.has(draft.category_id)) {
      const recovered = fuzzyFind(categories || [], draft.category_name);
      if (recovered) { draft.category_id = recovered.id; draft.category_name = recovered.name; }
      else { draft.category_id = null; draft.category_name = null; }
    }
    if (!draft.category_id && draft.category_name) {
      const recovered = fuzzyFind(categories || [], draft.category_name);
      if (recovered) { draft.category_id = recovered.id; draft.category_name = recovered.name; }
    }
    if (draft.subcategory_id && !subIds.has(draft.subcategory_id)) {
      const recovered = fuzzyFind(subcategories || [], draft.subcategory_name);
      draft.subcategory_id = recovered ? recovered.id : null;
      draft.subcategory_name = recovered ? recovered.name : null;
    }
    if (draft.payment_method_id && !pmIds.has(draft.payment_method_id)) {
      const recovered = fuzzyFind(paymentMethods || [], draft.payment_method_name);
      draft.payment_method_id = recovered ? recovered.id : null;
      draft.payment_method_name = recovered ? recovered.name : null;
    }

    // Resolve each split's person_id, falling back to fuzzy name match.
    draft.splits = (Array.isArray(draft.splits) ? draft.splits : []).map((s) => {
      let resolved = s.person_id && personIds.has(s.person_id) ? persons.find(p => p.id === s.person_id) : null;
      if (!resolved) resolved = fuzzyFind(persons || [], s.person_name);
      return {
        person_id: resolved?.id ?? null,
        person_name: resolved?.name ?? s.person_name ?? null,
        amount: typeof s.amount === 'number' && isFinite(s.amount) ? s.amount : null,
      };
    });

    // Flag (don't silently fix) if splits don't add up to the stated total —
    // the confirm step re-validates this too, but the draft should already
    // warn the user before they even see "¿confirmas?".
    const splitsSum = draft.splits.reduce((sum, s) => sum + (s.amount || 0), 0);
    if (draft.amount_total && draft.splits.length && Math.abs(splitsSum - draft.amount_total) > 0.01) {
      const warnings = new Set(draft.warnings || []);
      warnings.add(`Los montos no suman el total (${splitsSum} vs ${draft.amount_total}).`);
      draft.warnings = [...warnings];
    }
    if (draft.splits.some(s => !s.person_id)) {
      const missing = new Set(draft.missing_fields || []);
      missing.add('splits');
      draft.missing_fields = [...missing];
    }

    return Response.json({ draft, is_draft: true });
  } catch (error) {
    console.error('finiaPrepareSplitExpenseDraft error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
