// Touched 2026-10-05 to force a real redeploy of handlers/deleteAccount.ts's
// fix (#248): this repo's `functions deploy --force` change detector only
// looks at this file's own content, not recursively into handlers/, so an
// edit confined to a handler can report "unchanged" and skip redeploying —
// same defect already documented in CLAUDE.md for family/entry.ts (#247).
import { getHandler } from './handlers/index.ts';

Deno.serve(async (req) => {
  let action = '';
  try {
    const peek = await req.clone().json();
    if (peek && typeof peek.action === 'string') action = peek.action;
  } catch { /* no/invalid body */ }
  const handler = getHandler(action);
  if (!handler) return Response.json({ error: `admin: unknown action '${action}'` }, { status: 400 });
  return await handler(req);
});
