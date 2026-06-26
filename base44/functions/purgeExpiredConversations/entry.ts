import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { guardInternal } from './_internalGuard.ts';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const denied = await guardInternal(base44, req);
    if (denied) return denied;

    const now = new Date().toISOString();
    const BATCH = 200;
    let totalDeleted = 0;

    while (true) {
      const expired = await base44.asServiceRole.entities.ConversationSession.filter(
        { expires_at: { $lt: now } },
        'expires_at',
        BATCH,
        0
      );

      if (!expired || expired.length === 0) break;

      for (const session of expired) {
        await base44.asServiceRole.entities.ConversationSession.delete(session.id);
        totalDeleted++;
      }

      if (expired.length < BATCH) break;
    }

    console.log(`[purgeExpiredConversations] Deleted ${totalDeleted} expired sessions`);
    return Response.json({ success: true, deleted: totalDeleted });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error('[purgeExpiredConversations] Error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
});
