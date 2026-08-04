import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Converts natural language (and/or an attached bill/invoice photo) into a
// ScheduledPayment draft — a recurring monthly charge (rent, subscription,
// utility, payroll, etc.), NOT a one-off Transaction. See
// finiaPrepareTransactionDraft for the one-off equivalent; the two are
// intentionally separate tools so Finia can't confuse "pagué 850 en el
// súper" (one-off) with "quiero domiciliar mi recibo de luz" (recurring).
// DOES NOT SAVE ANYTHING. Only prepares a draft for user review.
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

    const [persons, categories, paymentMethods] = await Promise.all([
      userEntities.Person.filter({ family_id: familyId }),
      userEntities.Category.filter({ family_id: familyId }),
      userEntities.PaymentMethod.filter({ family_id: familyId }),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const selfPersonId = membership.person_id ?? null;
    const selfPerson = (persons || []).find(p => p.id === selfPersonId);

    const catalogsContext = JSON.stringify({
      persons: (persons || []).map(p => ({ id: p.id, name: p.name })),
      categories: (categories || []).map(c => ({ id: c.id, name: c.name, type: c.type })),
      payment_methods: (paymentMethods || []).map(m => ({ id: m.id, name: m.name, type: m.type })),
      self_person: selfPerson ? { id: selfPerson.id, name: selfPerson.name } : null,
      today,
    });

    const imageInstructions = file_urls.length
      ? `\nSe adjuntó una imagen (factura, recibo domiciliado o comprobante de suscripción). Analiza la imagen para extraer el nombre del servicio/proveedor, el monto a pagar y — muy importante — el día del mes en que vence o se cobra (due_day). Si el comprobante trae una fecha completa (ej. "vence el 15 de agosto"), usa el día (15) como due_day. Si además hay texto del usuario, úsalo como contexto adicional.\n`
      : '';

    const prompt = `Eres un parser de PAGOS PROGRAMADOS (cargos recurrentes mensuales) en español mexicano para una app financiera familiar.

Un pago programado es un cargo o cobro que se repite CADA MES: renta, colegiatura, suscripciones (streaming, gym), servicios (luz, agua, internet, teléfono), seguros, nómina recurrente, etc. NO es una compra puntual.

Analiza ${file_urls.length ? 'la imagen adjunta y el' : 'el'} siguiente texto y extrae los campos de un pago programado.
Responde ÚNICAMENTE con un JSON válido, sin explicaciones.
${imageInstructions}
CATÁLOGOS DISPONIBLES:
${catalogsContext}

REGLAS:
- name: nombre corto del servicio/proveedor (ej. "Luz CFE", "Netflix", "Renta departamento"). Requerido.
- due_day: día del mes (1-28) en que vence o se cobra. Si el usuario dice "cada quincena" o dos fechas, usa la primera. Requerido — si no se puede determinar con confianza, ponlo en missing_fields y usa null.
- amount: monto estimado del cargo. Puede ser null si es variable (ej. "mi recibo de luz varía cada mes"), pero intenta dar un estimado si el usuario o el comprobante lo mencionan.
- type: "expense" (domiciliado que se paga) o "income" (cobro recurrente, ej. nómina). Por default "expense".
- INFERENCIA DE CATEGORÍA: mismo criterio semántico que para transacciones — "luz", "agua", "gas" → Servicios/Hogar; "renta" → Hogar; "colegiatura" → Educación; streaming/gym → Entretenimiento/Personal. Elige la más cercana del catálogo, nunca null si alguna aplica.
- Para person_id: si el usuario no menciona persona responsable, usa self_person.id si existe.
- icon: UN emoji representativo del servicio (ej. 💡 luz, 💧 agua, 📶 internet, 🏠 renta, 🎬 streaming, 🎓 colegiatura). Default "💰".
- confidence: 0.0 a 1.0.
- missing_fields: lista de campos requeridos que faltan (name, due_day).
- warnings: avisos relevantes (ej. "el monto puede variar cada mes").

FORMATO DE RESPUESTA (JSON):
{
  "name": string | null,
  "description": string | null,
  "amount": number | null,
  "due_day": number | null,
  "type": "expense" | "income",
  "category_id": string | null,
  "category_name": string | null,
  "payment_method_id": string | null,
  "payment_method_name": string | null,
  "person_id": string | null,
  "person_name": string | null,
  "icon": string,
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
          name: { type: 'string' },
          description: { type: 'string' },
          amount: { type: 'number' },
          due_day: { type: 'number' },
          type: { type: 'string' },
          category_id: { type: 'string' },
          category_name: { type: 'string' },
          payment_method_id: { type: 'string' },
          payment_method_name: { type: 'string' },
          person_id: { type: 'string' },
          person_name: { type: 'string' },
          icon: { type: 'string' },
          confidence: { type: 'number' },
          missing_fields: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    const draft = aiResponse ?? {};

    // Normalize string for fuzzy matching: remove accents, lowercase, trim
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
    if (draft.person_id && !personIds.has(draft.person_id)) {
      const recovered = fuzzyFind(persons || [], draft.person_name);
      if (recovered) { draft.person_id = recovered.id; draft.person_name = recovered.name; }
      else { draft.person_id = selfPersonId; draft.person_name = selfPerson?.name ?? null; }
    }
    if (draft.payment_method_id && !pmIds.has(draft.payment_method_id)) {
      const recovered = fuzzyFind(paymentMethods || [], draft.payment_method_name);
      if (recovered) { draft.payment_method_id = recovered.id; draft.payment_method_name = recovered.name; }
      else { draft.payment_method_id = null; draft.payment_method_name = null; }
    }
    if (!draft.due_day || draft.due_day < 1 || draft.due_day > 28) {
      const missing = new Set(draft.missing_fields || []);
      missing.add('due_day');
      draft.missing_fields = [...missing];
      draft.due_day = null;
    }
    if (!draft.icon) draft.icon = '💰';

    return Response.json({ draft, is_draft: true });
  } catch (error) {
    console.error('finiaPrepareScheduledPaymentDraft error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
