import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const VALID_SOURCES = new Set(['tiktok', 'reddit', 'x', 'whatsapp', 'snapshot', 'organic', 'other']);

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function normaliseSource(raw: unknown): string {
  const s = String(raw || '').toLowerCase().trim();
  return VALID_SOURCES.has(s) ? s : 'organic';
}

/**
 * Unauthenticated: captures a waitlist signup from the public landing.
 *
 * Body: {
 *   email: string,        // required
 *   source?: string,      // tiktok | reddit | x | whatsapp | snapshot | organic | other
 *   referrer_code?: string,  // self_code of an existing lead
 *   utm_campaign?: string,
 *   utm_medium?: string,
 * }
 *
 * Returns: { success, already, self_code, share_url, referrals_count }
 *
 * - Soft-unique on email: if found, refresh the source/utm fields and
 *   return the existing self_code without creating a duplicate.
 * - When referrer_code matches an existing lead, that lead's
 *   referrals_count is incremented best-effort.
 * - All writes go through asServiceRole because the public landing has
 *   no session.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const rawEmail = String(body?.email || '').trim().toLowerCase();
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return Response.json({ error: 'invalid_email' }, { status: 400 });
    }

    const source = normaliseSource(body?.source);
    const referrerCode = String(body?.referrer_code || '').trim().toUpperCase().slice(0, 12) || undefined;
    const utmCampaign = String(body?.utm_campaign || '').trim().slice(0, 60) || undefined;
    const utmMedium = String(body?.utm_medium || '').trim().slice(0, 60) || undefined;

    // Soft-unique on email
    const existing = await base44.asServiceRole.entities.WaitlistSignup.filter({ email: rawEmail });
    if (existing?.length) {
      const lead = existing[0];
      const patch: Record<string, unknown> = {};
      if (source && source !== lead.source) patch.source = source;
      if (utmCampaign && utmCampaign !== lead.utm_campaign) patch.utm_campaign = utmCampaign;
      if (utmMedium && utmMedium !== lead.utm_medium) patch.utm_medium = utmMedium;
      if (referrerCode && !lead.referrer_code) patch.referrer_code = referrerCode;
      if (Object.keys(patch).length) {
        try {
          await base44.asServiceRole.entities.WaitlistSignup.update(lead.id, patch);
        } catch (updErr: unknown) {
          const message = updErr instanceof Error ? updErr.message : String(updErr);
          console.warn('[joinWaitlist] partial update failed:', message);
        }
      }
      return Response.json({
        success: true,
        already: true,
        self_code: lead.self_code,
        share_url: lead.self_code ? `/landing?ref=${lead.self_code}` : null,
        referrals_count: lead.referrals_count || 0,
      });
    }

    // Generate a unique self_code (retry up to 5 on collision)
    let selfCode: string | null = null;
    for (let i = 0; i < 5 && !selfCode; i += 1) {
      const candidate = randomCode();
      const collision = await base44.asServiceRole.entities.WaitlistSignup.filter({ self_code: candidate });
      if (!collision?.length) selfCode = candidate;
    }
    if (!selfCode) {
      return Response.json({ error: 'code_collision' }, { status: 500 });
    }

    await base44.asServiceRole.entities.WaitlistSignup.create({
      email: rawEmail,
      source,
      referrals_count: 0,
      self_code: selfCode,
      ...(referrerCode ? { referrer_code: referrerCode } : {}),
      ...(utmCampaign ? { utm_campaign: utmCampaign } : {}),
      ...(utmMedium ? { utm_medium: utmMedium } : {}),
    });

    // Credit the referrer (best-effort, never blocks the response)
    if (referrerCode) {
      try {
        const refLead = await base44.asServiceRole.entities.WaitlistSignup.filter({ self_code: referrerCode });
        const ref = refLead?.[0];
        if (ref) {
          await base44.asServiceRole.entities.WaitlistSignup.update(ref.id, {
            referrals_count: (ref.referrals_count || 0) + 1,
          });
        }
      } catch (refErr: unknown) {
        const message = refErr instanceof Error ? refErr.message : String(refErr);
        console.warn('[joinWaitlist] referrer credit failed:', message);
      }
    }

    return Response.json({
      success: true,
      already: false,
      self_code: selfCode,
      share_url: `/landing?ref=${selfCode}`,
      referrals_count: 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
