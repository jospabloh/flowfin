import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// One-time migration tool — admin only
// This function is intentionally left minimal as it was used for a specific data migration.
// To re-use, call via dashboard with the appropriate parameters in the request body.

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  return Response.json({ message: 'Esta función fue una herramienta de migración de datos y ya no está activa.' });
});