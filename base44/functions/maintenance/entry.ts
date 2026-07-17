import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { getHandler } from './handlers/index.ts';

// Actions that only ever act on the calling user's own record (never on
// another user/family via asServiceRole) and are therefore safe to run
// without a platform-admin role. Every other action here reaches into
// asServiceRole and MUST be admin-gated. This check is centralized so a new
// handler added to handlers/index.ts is protected by default even if it
// forgets its own role check — see the maintenance-router bypass finding.
const SELF_SERVICE_ACTIONS = new Set(['repairUserData']);

Deno.serve(async (req) => {
  let action = '';
  try {
    const peek = await req.clone().json();
    if (peek && typeof peek.action === 'string') action = peek.action;
  } catch { /* no/invalid body */ }

  const handler = getHandler(action);
  if (!handler) return Response.json({ error: `maintenance: unknown action '${action}'` }, { status: 400 });

  if (!SELF_SERVICE_ACTIONS.has(action)) {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  return await handler(req);
});
