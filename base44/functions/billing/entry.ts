import { getHandler } from './handlers/index.ts';
Deno.serve(async (req) => {
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const action = body?.action;
  const handler = getHandler(action);
  if (!handler) return Response.json({ error: `billing: unknown action '${action}'` }, { status: 400 });
  return await handler(req, body);
});
