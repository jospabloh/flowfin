import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Constants ──────────────────────────────────────────────────────────────

const DAILY_SCAN_CAP = 50;
const COST_PER_M_INPUT_TOKENS = 0.80;
const COST_PER_M_OUTPUT_TOKENS = 4.00;
const COST_PER_M_CACHE_READ_TOKENS = COST_PER_M_INPUT_TOKENS * 0.08;

const RECEIPT_SYSTEM_PROMPT =
  'You are a receipt-parsing assistant. Extract structured data from the provided receipt image. ' +
  'Return ONLY a valid JSON object with these fields: ' +
  '{ "amount": number, "currency": string (3-letter ISO code), "merchant": string, ' +
  '"date": string (YYYY-MM-DD or original text if unparseable), ' +
  '"category_guess": string (one of: Food, Groceries, Transport, Health, Entertainment, Education, Shopping, Utilities, Other), ' +
  '"confidence": number (0-1) }. ' +
  'If you cannot identify a clear receipt, return { "error": "not_a_receipt" }. ' +
  'No markdown, no explanation, ONLY the JSON object.';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeCostUsd(usage) {
  const inputCost = (usage.input_tokens / 1_000_000) * COST_PER_M_INPUT_TOKENS;
  const outputCost = (usage.output_tokens / 1_000_000) * COST_PER_M_OUTPUT_TOKENS;
  const cacheReadCost = ((usage.cache_read_input_tokens ?? 0) / 1_000_000) * COST_PER_M_CACHE_READ_TOKENS;
  return Math.round((inputCost + outputCost + cacheReadCost) * 1_000_000) / 1_000_000;
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no_json_in_response');
  return text.slice(start, end + 1);
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

// Inline family member validation (replaces local import)
async function assertFamilyMember(base44, familyId) {
  const user = await base44.auth.me();
  if (!user) throw Object.assign(new Error('Unauthorized'), { httpStatus: 401 });

  const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
    family_id: familyId,
    status: 'approved',
  });
  const isMember = memberships.some(m => m.user_id === user.id || m.user_email === user.email);
  if (!isMember) throw Object.assign(new Error('Forbidden'), { httpStatus: 403 });
  return user;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { imageB64, familyId, personId, locale = 'es-MX', mediaType = 'image/jpeg' } = body;

    if (!familyId || !imageB64) {
      return Response.json({ error: 'familyId and imageB64 are required' }, { status: 400 });
    }

    const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
      return Response.json({ error: 'unsupported_media_type' }, { status: 400 });
    }

    if (imageB64.length > 11 * 1024 * 1024) {
      return Response.json({ error: 'image_too_large' }, { status: 400 });
    }

    // Auth — must be an approved family member
    await assertFamilyMember(base44, familyId);

    // Daily cap check
    const todayStart = toISODate(new Date()) + 'T00:00:00.000Z';
    const todayEnd = toISODate(new Date()) + 'T23:59:59.999Z';

    let todayCount = 0;
    try {
      const todayScans = await base44.asServiceRole.entities.AssistantUsage.filter({
        family_id: familyId,
        operation: 'receipt_scan',
      });
      todayCount = todayScans.filter((row) => {
        const created = row.created_at ?? '';
        return created >= todayStart && created <= todayEnd;
      }).length;
    } catch {
      // Entity may not exist yet — proceed with count 0
    }

    if (todayCount >= DAILY_SCAN_CAP) {
      return Response.json({ error: 'daily_cap_exceeded' }, { status: 429 });
    }

    // Call Anthropic vision API
    const startedAt = Date.now();

    const visionBody = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: RECEIPT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType === 'image/heic' ? 'image/jpeg' : mediaType,
                data: imageB64,
              },
            },
            {
              type: 'text',
              text: `Locale hint: ${locale}. Parse this receipt and return the JSON object only.`,
            },
          ],
        },
      ],
    };

    const visionRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(visionBody),
    });

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      console.error('Anthropic API error:', visionRes.status, errText);
      return Response.json({ error: 'vision_api_error', detail: visionRes.status }, { status: 502 });
    }

    const visionData = await visionRes.json();
    const latencyMs = Date.now() - startedAt;

    const rawText = visionData.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');

    let parsed;
    try {
      parsed = JSON.parse(extractJson(rawText));
    } catch {
      return Response.json({ error: 'parse_failed', raw: rawText.slice(0, 200) }, { status: 422 });
    }

    const usage = {
      tokens_in: visionData.usage.input_tokens,
      tokens_out: visionData.usage.output_tokens,
      cache_read: visionData.usage.cache_read_input_tokens ?? 0,
      model: 'claude-haiku-4-5',
      cost_usd: computeCostUsd(visionData.usage),
      latency_ms: latencyMs,
    };

    // Persist usage row (fire-and-forget)
    try {
      await base44.asServiceRole.entities.AssistantUsage.create({
        family_id: familyId,
        person_id: personId || null,
        operation: 'receipt_scan',
        model: usage.model,
        tokens_in: usage.tokens_in,
        tokens_out: usage.tokens_out,
        cache_read: usage.cache_read,
        cost_usd: usage.cost_usd,
        latency_ms: usage.latency_ms,
        created_at: new Date().toISOString(),
      });
    } catch (persistErr) {
      console.warn('Failed to persist AssistantUsage row:', persistErr);
    }

    return Response.json({ ...parsed, usage });

  } catch (error) {
    const httpStatus = error.httpStatus;
    if (httpStatus === 403) return Response.json({ error: 'forbidden' }, { status: 403 });
    if (httpStatus === 401) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('scanReceipt error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});