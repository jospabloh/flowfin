import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { session_id } = await req.json();
  if (!session_id) return Response.json({ error: 'session_id required' }, { status: 400 });

  // Verify session belongs to this user
  const session = await base44.asServiceRole.entities.Session.filter({ user_id: user.id });
  const found = session.find(s => s.id === session_id);

  if (!found) return Response.json({ error: 'Session not found' }, { status: 404 });
  if (found.status === 'revoked') return Response.json({ error: 'Session revoked' }, { status: 403 });

  await base44.asServiceRole.entities.Session.update(session_id, {
    last_seen: new Date().toISOString(),
  });

  return Response.json({ ok: true, status: found.status });
});