import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { device_id, device_name } = await req.json();
  if (!device_id) return Response.json({ error: 'device_id required' }, { status: 400 });

  // Find or create session for this device
  const sessions = await base44.asServiceRole.entities.Session.filter({ user_id: user.id });
  let currentSession = sessions.find(s => s.device_id === device_id);

  const now = new Date().toISOString();

  if (currentSession) {
    // Update current device to active, last_seen
    await base44.asServiceRole.entities.Session.update(currentSession.id, {
      status: 'active',
      last_seen: now,
      device_name: device_name || currentSession.device_name,
    });
    currentSession = { ...currentSession, status: 'active', last_seen: now };
  } else {
    // Create new session for this device
    currentSession = await base44.asServiceRole.entities.Session.create({
      user_id: user.id,
      device_id,
      device_name: device_name || 'Dispositivo',
      status: 'active',
      last_seen: now,
    });
  }

  // Mark all other sessions for this user as passive
  const otherSessions = sessions.filter(s => s.device_id !== device_id && s.status === 'active');
  for (const s of otherSessions) {
    await base44.asServiceRole.entities.Session.update(s.id, { status: 'passive' });
  }

  return Response.json({ session: currentSession });
});