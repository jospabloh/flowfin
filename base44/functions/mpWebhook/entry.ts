import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * mpWebhook — Receives Mercado Pago IPN / webhook notifications.
 *
 * Pipeline:
 *   1. Validate x-signature header against MERCADOPAGO_WEBHOOK_SECRET.
 *   2. Parse the notification (topic + data.id).
 *   3. Fetch full payment details from MP REST API using
 *      MERCADOPAGO_ACCESS_TOKEN.
 *   4. Idempotency: skip if a PaymentEvent with the same
 *      provider_event_id already exists.
 *   5. Log the event into PaymentEvent.
 *   6. If status='approved' and external_reference resolves to a known
 *      family, activate / extend the licence and email the admin.
 *      external_reference format: "family_id:plan:period" (period is YYYY-MM).
 *
 * Always returns 200 to MP unless signature validation fails (401).
 * MP retries non-200 responses; we don't want retries once we've logged
 * the event — recovery happens via the admin panel re-running the
 * processed_outcome=error rows.
 *
 * Env vars required (set in Base44 dashboard):
 *   MERCADOPAGO_WEBHOOK_SECRET — the secret used to compute x-signature
 *   MERCADOPAGO_ACCESS_TOKEN   — server-side access token to fetch
 *                                payment details
 *   APP_URL                    — used in the confirmation email
 */

const PLAN_LIMITS: Record<string, number> = { home: 4, family_plus: 10, circle: 20 };
const PLAN_LABELS: Record<string, string> = {
  home: 'FlowFin Home',
  family_plus: 'FlowFin Family+',
  circle: 'FlowFin Circle',
};

function calculateExpiry(currentExpiresAt: string | undefined, monthsToExtend = 1): string {
  const now = new Date();
  const base = currentExpiresAt && new Date(currentExpiresAt) > now
    ? new Date(currentExpiresAt)
    : now;
  const next = new Date(base);
  next.setMonth(next.getMonth() + monthsToExtend);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

async function hmacHexSHA256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseSignatureHeader(value: string | null): { ts: string | null; v1: string | null } {
  if (!value) return { ts: null, v1: null };
  const parts = value.split(',').map((s) => s.trim());
  const out: Record<string, string> = {};
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx)] = part.slice(idx + 1);
  }
  return { ts: out.ts || null, v1: out.v1 || null };
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * MP composes the signed string as:
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * (see https://www.mercadopago.com.mx/developers/en/docs/your-integrations/notifications/webhooks)
 */
async function verifyMpSignature(req: Request, dataId: string): Promise<boolean> {
  const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
  if (!secret) return false;
  const sigHeader = req.headers.get('x-signature');
  const reqIdHeader = req.headers.get('x-request-id') || '';
  const { ts, v1 } = parseSignatureHeader(sigHeader);
  if (!ts || !v1) return false;
  const message = `id:${dataId};request-id:${reqIdHeader};ts:${ts};`;
  try {
    const expected = await hmacHexSHA256(secret, message);
    return safeEqual(expected, v1);
  } catch {
    return false;
  }
}

interface PaymentDetails {
  id: number | string;
  status: string;
  status_detail?: string;
  transaction_amount?: number;
  currency_id?: string;
  external_reference?: string;
  date_approved?: string;
  payment_method_id?: string;
}

async function fetchMpPayment(paymentId: string): Promise<PaymentDetails | null> {
  const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
  if (!accessToken) return null;
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return await res.json() as PaymentDetails;
  } catch {
    return null;
  }
}

function parseExternalReference(ref: string | undefined): { family_id?: string; plan?: string; period?: string } {
  if (!ref) return {};
  const parts = ref.split(':');
  return {
    family_id: parts[0] || undefined,
    plan: parts[1] || 'home',
    period: parts[2] || undefined,
  };
}

function defaultPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const raw = await req.json().catch(() => ({}));
    const dataId = String(raw?.data?.id || raw?.id || '');
    const eventType = String(raw?.type || raw?.action || raw?.topic || 'unknown');

    if (!dataId) {
      return Response.json({ ok: false, error: 'missing_data_id' }, { status: 400 });
    }

    // Step 1: signature verification (skip in unit tests by setting
    // MERCADOPAGO_WEBHOOK_SECRET to an empty value — by default the
    // check fails closed).
    const signatureValid = await verifyMpSignature(req, dataId);
    if (!signatureValid) {
      console.warn(`[mpWebhook] rejected — signature invalid for data.id=${dataId}`);
      return Response.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
    }

    // Step 2: idempotency check
    const existing = await base44.asServiceRole.entities.PaymentEvent.filter({
      provider: 'mercadopago',
      provider_event_id: dataId,
    });
    if (existing?.length) {
      return Response.json({ ok: true, deduped: true });
    }

    // Step 3: fetch payment details
    const payment = await fetchMpPayment(dataId);
    const status = payment?.status || 'unknown';
    const amount = payment?.transaction_amount;
    const currency = payment?.currency_id || 'MXN';
    const externalRef = payment?.external_reference;
    const { family_id, plan, period } = parseExternalReference(externalRef);

    // Step 4: persist the event
    const eventRecord = await base44.asServiceRole.entities.PaymentEvent.create({
      provider: 'mercadopago',
      provider_event_id: dataId,
      event_type: eventType,
      status,
      ...(amount !== undefined ? { amount } : {}),
      currency,
      ...(externalRef ? { external_reference: externalRef } : {}),
      ...(family_id ? { family_id } : {}),
      raw_payload_json: { notification: raw, payment },
      signature_valid: true,
    });

    // Step 5: process if approved + we can resolve the family
    let outcome = 'skipped';
    let notes = '';
    try {
      if (status !== 'approved') {
        notes = `status=${status}`;
      } else if (!family_id) {
        notes = 'no_external_reference';
      } else {
        const families = await base44.asServiceRole.entities.Family.filter({ id: family_id });
        const family = families?.[0];
        if (!family) {
          notes = 'family_not_found';
        } else {
          const resolvedPlan = (plan && PLAN_LIMITS[plan]) ? plan : (family.license_plan || 'home');
          const resolvedPeriod = period || defaultPeriod();
          const newExpiresAt = calculateExpiry(family.license_expires_at, 1);

          await base44.asServiceRole.entities.Family.update(family_id, {
            billing_status: 'active',
            license_plan: resolvedPlan,
            licensed_member_limit: PLAN_LIMITS[resolvedPlan],
            license_activated_at: new Date().toISOString(),
            license_expires_at: newExpiresAt,
            auto_renewal: true,
            last_payment_confirmed_at: new Date().toISOString(),
            last_payment_confirmed_by: 'mercadopago:webhook',
            last_payment_period: resolvedPeriod,
            last_payment_reference: String(dataId),
            last_payment_notes: `Webhook MP automático · ${PLAN_LABELS[resolvedPlan] || resolvedPlan}`,
          });

          // Queue payment_confirmed email — non-fatal
          try {
            const memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
              family_id,
              role: 'admin',
              status: 'approved',
            });
            const adminEmail = memberships?.[0]?.user_email;
            if (adminEmail) {
              const notificationKey = `${family_id}:payment_confirmed:${resolvedPeriod}`;
              const alreadySent = await base44.asServiceRole.entities.EmailNotification.filter({ notification_key: notificationKey });
              if (!alreadySent?.some((e: { status: string }) => e.status === 'sent')) {
                await base44.asServiceRole.entities.EmailNotification.create({
                  family_id,
                  email_type: 'payment_confirmed',
                  recipient_email: adminEmail,
                  status: 'pending',
                  retry_count: 0,
                  notification_key: notificationKey,
                  billing_period: resolvedPeriod,
                  metadata: {
                    app_name: 'FlowFin',
                    family_name: family.name,
                    plan_name: PLAN_LABELS[resolvedPlan] || resolvedPlan,
                    license_expires_at: newExpiresAt,
                    billing_period: resolvedPeriod,
                    user_name: memberships?.[0]?.user_name || null,
                    via: 'mercadopago_webhook',
                  },
                });
              }
            }
          } catch (emailErr: unknown) {
            const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
            console.warn('[mpWebhook] email queueing failed:', msg);
          }

          outcome = 'ok';
          notes = `family=${family_id} plan=${resolvedPlan} period=${resolvedPeriod}`;
        }
      }
    } catch (processErr: unknown) {
      outcome = 'error';
      notes = processErr instanceof Error ? processErr.message : String(processErr);
    }

    try {
      await base44.asServiceRole.entities.PaymentEvent.update(eventRecord.id, {
        processed_at: new Date().toISOString(),
        processed_outcome: outcome,
        processed_notes: notes,
      });
    } catch (updErr: unknown) {
      const msg = updErr instanceof Error ? updErr.message : String(updErr);
      console.warn('[mpWebhook] processed update failed:', msg);
    }

    return Response.json({ ok: true, status, outcome });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[mpWebhook] error:', message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
