import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// DEPRECATED: Superseded by checkAccountLifecycle, which handles the full lifecycle
// (trial, view_only, archived, deletion, active license expiry, monthly renewal).
// This wrapper is kept so existing scheduler configuration continues to work.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    console.log('[checkTrialExpiration] Delegating to checkAccountLifecycle');
    const result = await base44.functions.invoke('checkAccountLifecycle', {});
    return Response.json({
      success: true,
      delegated_to: 'checkAccountLifecycle',
      result: result.data,
    });
  } catch (error: any) {
    console.error('[checkTrialExpiration] Delegation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
