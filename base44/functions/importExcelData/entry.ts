import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// One-time migration tool — admin only
// This function was used for initial data import and is no longer active.

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  return Response.json({ message: 'Esta función fue una herramienta de importación de datos y ya no está activa.' });
});