import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Scheduled daily function: finds all trial families whose trial_end_at has passed
// and changes their billing_status to view_only.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date().toISOString();

    // Fetch all families currently in trial
    const trialFamilies = await base44.asServiceRole.entities.Family.filter({ billing_status: 'trial' });

    let expired = 0;
    const expiredNames = [];

    for (const family of trialFamilies) {
      if (family.trial_end_at && family.trial_end_at <= now) {
        await base44.asServiceRole.entities.Family.update(family.id, {
          billing_status: 'view_only',
        });
        expired++;
        expiredNames.push(family.name);
      }
    }

    console.log(`[checkTrialExpiration] Checked: ${trialFamilies.length}, Expired: ${expired}`);
    if (expiredNames.length) console.log(`Expired families: ${expiredNames.join(', ')}`);

    return Response.json({
      success: true,
      checked: trialFamilies.length,
      expired,
      timestamp: now,
    });
  } catch (error) {
    console.error('[checkTrialExpiration] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});