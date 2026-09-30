import { getHandler } from './handlers/index.ts';

// Deploy-cache-buster: `npx base44 functions deploy --force` reported this
// function "unchanged" after switchFamily.ts/switchFamilyLogic.ts were added
// (esos dos archivos ya no existen — el selector de familia se retiró el
// 2026-09-10; se conservan aquí como el ejemplo real del que salió la lección)
// to handlers/ and index.ts was updated to register the new action — the
// CLI's change-detection didn't pick up files added under handlers/ that
// this file (the actual Deno.serve entry point) doesn't itself reference by
// content diff. Verified live: an unauthenticated POST with
// {"action":"switchFamily"} against the deployed function returned
// `{"error":"family: unknown action 'switchFamily'"}` — the new action was
// never actually shipped despite two "unchanged" deploy reports. Touching
// this file forces the CLI to see a real diff. See CLAUDE.md.
// 2026-09-30: touched again for approveMember (role choice), rejectMember,
// cancelJoinRequest and the one-family rule in selfJoin/createFamily.
Deno.serve(async (req) => {
  let action = '';
  try {
    const peek = await req.clone().json();
    if (peek && typeof peek.action === 'string') action = peek.action;
  } catch { /* no/invalid body */ }
  const handler = getHandler(action);
  if (!handler) return Response.json({ error: `family: unknown action '${action}'` }, { status: 400 });
  return await handler(req);
});
