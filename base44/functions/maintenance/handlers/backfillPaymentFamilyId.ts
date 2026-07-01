import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// One-off migration: denormalize family_id onto InvestmentPayment and MSIPayment
// records that don't have it yet, deriving it from their parent Investment / MSI.
// Must run AFTER the family_id field is deployed and BEFORE the family-scoped RLS
// is tightened, so existing records remain visible. Idempotent and safe to re-run.
//
// Admin-only. Invoke as the app owner (User.role === 'admin'), e.g. from
// `base44 exec` or the function endpoint with an admin session.

// deno-lint-ignore no-explicit-any
async function fetchAll(filterFn: (limit: number, skip: number) => Promise<any[]>) {
  const PAGE = 200;
  // deno-lint-ignore no-explicit-any
  let all: any[] = [];
  let skip = 0;
  while (true) {
    const page = await filterFn(PAGE, skip);
    all = all.concat(page || []);
    if (!page || page.length < PAGE) break;
    skip += PAGE;
    if (all.length >= 20000) break;
  }
  return all;
}

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    const sr = base44.asServiceRole.entities;
    const dryRun = await req.json().then((b) => !!b?.dryRun).catch(() => false);

    // Parent → family_id maps
    const investments = await fetchAll((l, s) => sr.Investment.filter({}, '-created_date', l, s));
    const invFamily = new Map(investments.map((i) => [i.id, i.family_id]));
    const msis = await fetchAll((l, s) => sr.MSI.filter({}, '-created_date', l, s));
    const msiFamily = new Map(msis.map((m) => [m.id, m.family_id]));

    const out = {
      dryRun,
      investmentPayments: { scanned: 0, updated: 0, alreadySet: 0, noParent: 0 },
      msiPayments: { scanned: 0, updated: 0, alreadySet: 0, noParent: 0 },
    };

    const invPayments = await fetchAll((l, s) => sr.InvestmentPayment.filter({}, '-created_date', l, s));
    for (const p of invPayments) {
      out.investmentPayments.scanned++;
      if (p.family_id) { out.investmentPayments.alreadySet++; continue; }
      const fam = invFamily.get(p.investment_id);
      if (!fam) { out.investmentPayments.noParent++; continue; }
      if (!dryRun) await sr.InvestmentPayment.update(p.id, { family_id: fam });
      out.investmentPayments.updated++;
    }

    const msiPayments = await fetchAll((l, s) => sr.MSIPayment.filter({}, '-created_date', l, s));
    for (const p of msiPayments) {
      out.msiPayments.scanned++;
      if (p.family_id) { out.msiPayments.alreadySet++; continue; }
      const fam = msiFamily.get(p.msi_id);
      if (!fam) { out.msiPayments.noParent++; continue; }
      if (!dryRun) await sr.MSIPayment.update(p.id, { family_id: fam });
      out.msiPayments.updated++;
    }

    return Response.json({ ok: true, ...out });
  } catch (error) {
    console.error('backfillPaymentFamilyId error:', error);
    return Response.json({ error: (error as { message?: string })?.message || 'internal' }, { status: 500 });
  }
}
