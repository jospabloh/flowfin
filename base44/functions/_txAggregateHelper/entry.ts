// This file is intentionally a no-op placeholder.
// Shared helper logic is inlined directly into each function that needs it.
Deno.serve(async (_req) => {
  return Response.json({ error: 'not_a_public_function' }, { status: 404 });
});