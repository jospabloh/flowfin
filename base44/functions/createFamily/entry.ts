import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { family_name, default_categories, default_subcategories, default_payment_methods } = await req.json();

    if (!family_name?.trim()) {
      return Response.json({ error: 'family_name requerido' }, { status: 400 });
    }

    const clean = family_name.toUpperCase().replace(/\s+/g, '').slice(0, 6);
    const num = Math.floor(100 + Math.random() * 900);
    const join_code = `${clean}${num}`;

    // Create family using service role (bypasses RLS)
    // Set server-side trial dates (never trust client time for commercial state)
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const family = await base44.asServiceRole.entities.Family.create({
      name: family_name.trim(),
      join_code,
      admin_user_id: user.id,
      is_active: true,
      trial_start_at: now.toISOString(),
      trial_end_at: trialEnd.toISOString(),
      billing_status: 'trial',
      license_plan: 'home',
      licensed_member_limit: 4,
    });

    // Queue welcome email (non-fatal — family creation succeeds even if this fails)
    try {
      await base44.asServiceRole.entities.EmailNotification.create({
        family_id: family.id,
        email_type: 'trial_welcome',
        recipient_email: user.email,
        status: 'pending',
        retry_count: 0,
      });
    } catch (emailErr: any) {
      console.warn('[createFamily] Failed to queue welcome email:', emailErr.message);
    }

    // Create admin membership
    await base44.asServiceRole.entities.FamilyMembership.create({
      family_id: family.id,
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name,
      role: 'admin',
      status: 'approved',
    });

    // Update user's family_id in their profile and promote to admin
    const userData = { ...(user.data || {}), family_id: family.id };
    delete userData.data;
    await base44.asServiceRole.entities.User.update(user.id, { data: userData, role: 'admin' });

    // Seed categories
    if (default_categories?.length) {
      const cats = await base44.asServiceRole.entities.Category.bulkCreate(
        default_categories.map(c => ({ ...c, family_id: family.id }))
      );

      if (default_subcategories?.length) {
        // Build name->id map
        const catMap = {};
        cats.forEach((c, i) => { catMap[default_categories[i].name] = c.id; });

        const subsToCreate = [];
        default_subcategories.forEach(sub => {
          const catId = catMap[sub._category_name] || '';
          const { _category_name, ...rest } = sub;
          subsToCreate.push({ ...rest, family_id: family.id, category_id: catId });
        });
        await base44.asServiceRole.entities.Subcategory.bulkCreate(subsToCreate);
      }
    }

    if (default_payment_methods?.length) {
      await base44.asServiceRole.entities.PaymentMethod.bulkCreate(
        default_payment_methods.map(m => ({ ...m, family_id: family.id }))
      );
    }

    return Response.json({ success: true, family_id: family.id, join_code });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});