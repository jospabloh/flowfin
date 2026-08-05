// Shared guard for system / cron / internal backend functions.
//
// These functions are triggered by Base44 automations (configured in the
// dashboard) and must NOT require an end-user session, or the scheduler would
// break. They also expose a public HTTP endpoint that anyone could POST to.
//
// This guard is FAIL-CLOSED: if the CRON_SECRET secret is not configured, the
// internal endpoints are disabled entirely (403). Once CRON_SECRET is set in
// Base44 secrets, callers must either:
//   - send a matching `x-cron-secret` header (add it to the automation config), or
//   - be an authenticated admin user (for manual runs from the panel/app).
// Anything else gets 403.
//
// Returns null when the request is allowed, or a Response to return when denied.
// deno-lint-ignore no-explicit-any
export async function guardInternal(base44: any, req: Request): Promise<Response | null> {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) {
    // Fail-closed: no secret configured → deny all internal invocations.
    return Response.json({ error: 'internal endpoint not configured' }, { status: 403 });
  }

  const provided = req.headers.get('x-cron-secret');
  if (provided && provided === secret) return null;

  try {
    const user = await base44.auth.me();
    if (user && user.role === 'admin') return null;
  } catch {
    // no authenticated user — fall through to denial
  }

  return Response.json({ error: 'forbidden' }, { status: 403 });
}