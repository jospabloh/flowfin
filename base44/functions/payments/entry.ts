import { getHandler } from './handlers/index.ts';

Deno.serve(async (req) => {
  let action = '';
  try {
    const peek = await req.clone().json();
    if (peek && typeof peek.action === 'string') action = peek.action;
  } catch { /* no/invalid body */ }
  const handler = getHandler(action);
  if (!handler) return Response.json({ error: `payments: unknown action '${action}'` }, { status: 400 });
  return await handler(req);
});
