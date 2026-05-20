import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Admin-only one-shot backfill: ensures every Family has a `default_person_id`
 * and that the admin's FamilyMembership has a linked `person_id`.
 *
 * For families created before the zero-friction sprint, the admin may not have
 * a Person record. This function:
 *   1. Lists all families.
 *   2. For each family without `default_person_id`:
 *      a. Look for an existing Person in the family whose name matches the
 *         admin's user_name (heuristic to avoid duplicates).
 *      b. If none, create a Person using the admin user's full_name/email.
 *      c. Update Family.default_person_id.
 *      d. Update the admin FamilyMembership.person_id (only if currently empty).
 *
 * Body: { dry_run?: boolean, family_id?: string }
 *   - dry_run=true reports what would change without writing.
 *   - family_id=<id> restricts the backfill to a single family (useful for
 *     verification after a migration).
 *
 * Returns: { success, processed, updated, skipped, errors }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const onlyFamilyId: string | undefined = body?.family_id;

    const families = onlyFamilyId
      ? await base44.asServiceRole.entities.Family.filter({ id: onlyFamilyId })
      : await base44.asServiceRole.entities.Family.list();

    const report = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ family_id: string; reason: string }>,
      details: [] as Array<{
        family_id: string;
        family_name: string;
        action: 'already_set' | 'reused_person' | 'created_person' | 'no_admin' | 'error';
        person_id?: string;
        membership_updated?: boolean;
      }>,
    };

    for (const family of families) {
      report.processed += 1;

      if (family.default_person_id) {
        report.skipped += 1;
        report.details.push({
          family_id: family.id,
          family_name: family.name,
          action: 'already_set',
          person_id: family.default_person_id,
        });
        continue;
      }

      try {
        const adminMemberships = await base44.asServiceRole.entities.FamilyMembership.filter({
          family_id: family.id,
          role: 'admin',
        });
        const adminMembership = adminMemberships?.[0];

        if (!adminMembership) {
          report.errors.push({ family_id: family.id, reason: 'no admin membership found' });
          report.details.push({
            family_id: family.id,
            family_name: family.name,
            action: 'no_admin',
          });
          continue;
        }

        const adminName = (adminMembership.user_name || adminMembership.user_email || 'Yo').trim();

        const existingPersons = await base44.asServiceRole.entities.Person.filter({
          family_id: family.id,
        });
        let person = existingPersons.find(
          (p: { name?: string }) => (p.name || '').trim().toLowerCase() === adminName.toLowerCase(),
        );

        let action: 'reused_person' | 'created_person';
        if (person) {
          action = 'reused_person';
        } else {
          if (dryRun) {
            report.details.push({
              family_id: family.id,
              family_name: family.name,
              action: 'created_person',
              person_id: '(dry_run)',
            });
            report.updated += 1;
            continue;
          }
          const initial = adminName.charAt(0).toUpperCase() || 'Y';
          person = await base44.asServiceRole.entities.Person.create({
            family_id: family.id,
            name: adminName,
            avatar_initial: initial,
            color: '#059669',
          });
          action = 'created_person';
        }

        if (!dryRun) {
          await base44.asServiceRole.entities.Family.update(family.id, {
            default_person_id: person!.id,
          });

          let membershipUpdated = false;
          if (!adminMembership.person_id) {
            await base44.asServiceRole.entities.FamilyMembership.update(adminMembership.id, {
              person_id: person!.id,
            });
            membershipUpdated = true;
          }

          report.details.push({
            family_id: family.id,
            family_name: family.name,
            action,
            person_id: person!.id,
            membership_updated: membershipUpdated,
          });
        } else {
          report.details.push({
            family_id: family.id,
            family_name: family.name,
            action,
            person_id: person!.id,
          });
        }

        report.updated += 1;
      } catch (familyErr: unknown) {
        const message = familyErr instanceof Error ? familyErr.message : String(familyErr);
        report.errors.push({ family_id: family.id, reason: message });
        report.details.push({
          family_id: family.id,
          family_name: family.name,
          action: 'error',
        });
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      ...report,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
});
