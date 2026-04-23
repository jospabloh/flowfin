import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { assertFamilyMember } from '../_txAggregateHelper.ts';

// ─── Constants ─────────────────────────────────────────────────────────────────

const DAILY_SCAN_CAP = 50; // scans per family per day — promote to FamilyConfig later

// Pricing as of 2025 for claude-haiku-4-5 (input / output per M tokens)
const COST_PER_M_INPUT_TOKENS = 0.80;   // USD
const COST_PER_M_OUTPUT_TOKENS = 4.00;  // USD
// Cache read discount: 0.08 × input price
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeCostUsd(usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number }): number {
  const inputCost = (usage.input_tokens / 1_000_000) * COST_PER_M_INPUT_TOKENS;
  const outputCost = (usage.output_tokens / 1_000_000) * COST_PER_M_OUTPUT_TOKENS;
  const cacheReadCost = ((usage.cache_read_input_tokens ?? 0) / 1_000_000) * COST_PER_M_CACHE_READ_TOKENS;
  return Math.round((inputCost + outputCost + cacheReadCost) * 1_000_000) / 1_000_000;
}

/** Extract the first JSON object found in a string (handles LLM preamble). */
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no_json_in_response');
  return text.slice(start, end + 1);
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    // TODO: confirm secret name with Base44 admin
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { imageB64, familyId, personId, locale = 'es-MX', mediaType = 'image/jpeg' } = body as {
      imageB64: string;
      familyId: string;
      personId: string;
      locale?: string;
      mediaType?: string;
    };

    // 1. Validate required input.
    if (!familyId || !imageB64) {
      return Response.json({ error: 'familyId and imageB64 are required' }, { status: 400 });
    }

    // Validate media type whitelist.
    const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
      return Response.json({ error: 'unsupported_media_type' }, { status: 400 });
    }

    // Rough size check: base64 ~ 1.37× binary; 8 MB → ~11 MB base64.
    if (imageB64.length > 11 * 1024 * 1024) {
      return Response.json({ error: 'image_too_large' }, { status: 400 });
    }

    // 2. Auth — must be an approved family member before any data query.
    await assertFamilyMember(base44, familyId);

    // 3. Daily cap check — count today's scans for this family.
    const todayStart = toISODate(new Date()) + 'T00:00:00.000Z';
    const todayEnd = toISODate(new Date()) + 'T23:59:59.999Z';

    let todayCount = 0;
    try {
      const todayScans = await base44.asServiceRole.entities.AssistantUsage.filter({
        family_id: familyId,
        operation: 'receipt_scan',
      });
      todayCount = (todayScans as Array<Record<string, string>>).filter((row) => {
        const created = row.created_at ?? '';
        return created >= todayStart && created <= todayEnd;
      }).length;
    } catch {
      // If entity doesn't exist yet, count is 0 — proceed.
    }

    if (todayCount >= DAILY_SCAN_CAP) {
      return Response.json({ error: 'daily_cap_exceeded' }, { status: 429 });
    }

    // 4. Call Anthropic vision API.
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

    const visionData = await visionRes.json() as {
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
    };

    const latencyMs = Date.now() - startedAt;

    // 5. Parse structured response.
    const rawText = visionData.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(extractJson(rawText));
    } catch {
      return Response.json({ error: 'parse_failed', raw: rawText.slice(0, 200) }, { status: 422 });
    }

    // 6. Compute usage metrics.
    const usage = {
      tokens_in: visionData.usage.input_tokens,
      tokens_out: visionData.usage.output_tokens,
      cache_read: visionData.usage.cache_read_input_tokens ?? 0,
      model: 'claude-haiku-4-5',
      cost_usd: computeCostUsd(visionData.usage),
      latency_ms: latencyMs,
    };

    // 7. Persist usage row (fire-and-forget on error — don't fail the scan).
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
    const httpStatus = (error as Record<string, number>).httpStatus;
    if (httpStatus === 403) return Response.json({ error: 'forbidden' }, { status: 403 });
    if (httpStatus === 401) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('scanReceipt error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
