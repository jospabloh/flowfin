import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { guardInternal } from './_internalGuard.ts';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// DEPRECATED: Superseded by checkAccountLifecycle, which handles the full lifecycle
// (trial, view_only, archived, deletion, active license expiry, monthly renewal).
// This wrapper is kept so existing scheduler configuration continues to work.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const denied = await guardInternal(base44, req);
    if (denied) return denied;
    console.log('[checkTrialExpiration] Delegating to checkAccountLifecycle');
    const result = await base44.functions.invoke('checkAccountLifecycle', {});
    return Response.json({
      success: true,
      delegated_to: 'checkAccountLifecycle',
      result: result.data,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error('[checkTrialExpiration] Delegation error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
});
