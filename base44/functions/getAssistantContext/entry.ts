import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  assertFamilyMember,
  fetchAllTransactions,
  sumByType,
  groupSum,
  toISODate,
} from '../_txAggregateHelper.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trunc(s: string | undefined | null, max = 80): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { familyId, personId: rawPersonId, locale: _locale } = body;

    // 1. Validate required input.
    if (!familyId) {
      return Response.json({ error: 'familyId required' }, { status: 400 });
    }

    // 2. Auth — must be an approved family member before any data query.
    const { user, membership } = await assertFamilyMember(base44, familyId);
    const u = user as Record<string, string>;
    const m = membership as Record<string, string>;

    // 3. Date range: first day of current month → today.
    const today = new Date();
    const start = toISODate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
    const end = toISODate(today);
    const label = start.slice(0, 7); // 'YYYY-MM'

    // ── Parallel: fetch catalogues + transactions + upcoming sources ──────────

    const entities = base44.asServiceRole.entities;

    // Validate personId asynchronously alongside other fetches.
    const [
      familyArr,
      membershipsArr,
      personsArr,
      categoriesArr,
      txResult,
      scheduledArr,
      msiArr,
      investmentArr,
      rentalArr,
      familyConfigArr,
    ] = await Promise.all([
      entities.Family.filter({ id: familyId }),
      entities.FamilyMembership.filter({ family_id: familyId, status: 'approved' }),
      entities.Person.filter({ family_id: familyId }),
      entities.Category.filter({ family_id: familyId }),
      fetchAllTransactions(base44, { familyId, start, end }),
      // upcomingCommitments — each wrapped so a missing entity won't crash.
      (async () => { try { return await entities.ScheduledPayment.filter({ family_id: familyId }); } catch { return []; } })(),
      (async () => { try { return await entities.MSIPayment.filter({ family_id: familyId }); } catch { return []; } })(),
      (async () => { try { return await entities.InvestmentPayment.filter({ family_id: familyId }); } catch { return []; } })(),
      (async () => { try { return await entities.RentalPayment.filter({ family_id: familyId }); } catch { return []; } })(),
      (async () => { try { return await entities.FamilyConfig.filter({ family_id: familyId }); } catch { return []; } })(),
    ]);

    const { transactions: txs, truncated } = txResult;

    // ── user ─────────────────────────────────────────────────────────────────
    const userOut = {
      id: u.id,
      email: u.email,
      name: (m.user_name as string) || u.email,
    };

    // ── person ────────────────────────────────────────────────────────────────
    let personId: string | null = rawPersonId ?? null;
    let personOut: { id: string; name: string } | null = null;
    if (personId) {
      const found = (personsArr as Array<Record<string, string>>)
        .find((p) => p.id === personId && p.family_id === familyId);
      if (!found) personId = null;
      else personOut = { id: found.id, name: found.name ?? found.id };
    }

    // ── family ────────────────────────────────────────────────────────────────
    const fam = (familyArr as Array<Record<string, unknown>>)[0] ?? {};
    const familyOut = {
      id: fam.id,
      name: fam.name,
      currency: fam.currency,
      currency_symbol: fam.currency_symbol,
      plan: fam.license_plan,
      billing_status: fam.billing_status,
    };

    // ── members ───────────────────────────────────────────────────────────────
    const personMap = new Map(
      (personsArr as Array<Record<string, string>>).map((p) => [p.id, p])
    );
    const membershipsByPersonId = new Map(
      (membershipsArr as Array<Record<string, string>>).map((ms) => [ms.person_id, ms])
    );

    // Start from memberships (linked persons).
    const membersOut: Array<{ person_id: string | null; name: string; role: string | null; linked_user_email: string | null }> = [];
    const seenPersonIds = new Set<string>();

    for (const ms of membershipsArr as Array<Record<string, string>>) {
      const pid = ms.person_id ?? null;
      const person = pid ? personMap.get(pid) : undefined;
      seenPersonIds.add(pid ?? ms.id);
      membersOut.push({
        person_id: pid,
        name: person?.name ?? ms.user_name ?? ms.user_email ?? pid ?? ms.id,
        role: ms.role ?? null,
        linked_user_email: ms.user_email ?? null,
      });
    }
    // Persons without a linked membership.
    for (const p of personsArr as Array<Record<string, string>>) {
      if (!seenPersonIds.has(p.id)) {
        membersOut.push({ person_id: p.id, name: p.name ?? p.id, role: null, linked_user_email: null });
      }
    }

    // ── month aggregations (one txs array, zero extra fetches) ─────────────────
    const totals = sumByType(txs);

    // byPerson
    const personAggMap = new Map<string, { expense: number; income: number; count: number }>();
    for (const tx of txs) {
      if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
      const key = tx.person_id ?? '__none__';
      const entry = personAggMap.get(key) ?? { expense: 0, income: 0, count: 0 };
      if (tx.type === 'expense') entry.expense += tx.amount;
      else if (tx.type === 'income') entry.income += tx.amount;
      entry.count++;
      personAggMap.set(key, entry);
    }
    const byPerson = Array.from(personAggMap.entries()).map(([pid, agg]) => {
      const person = pid !== '__none__' ? personMap.get(pid) : undefined;
      return {
        person_id: pid === '__none__' ? null : pid,
        name: person?.name ?? (pid === '__none__' ? 'Sin persona' : pid),
        expense: agg.expense,
        income: agg.income,
        count: agg.count,
      };
    }).sort((a, b) => b.expense - a.expense);

    // topCategories
    const catMap = new Map(
      (categoriesArr as Array<Record<string, string>>).map((c) => [c.id, c.name ?? c.id])
    );
    const topCategoriesRaw = groupSum(txs, (tx) => tx.category_id ?? null, 'expense').slice(0, 5);
    const topCategories = topCategoriesRaw.map(({ key, total, count }) => ({
      category_id: key,
      name: catMap.get(key) ?? key,
      total,
      count,
    }));

    // recentTransactions — top 10 sorted by date desc
    const recentTransactions = [...txs]
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
      .slice(0, 10)
      .map((tx) => ({
        id: (tx as unknown as Record<string, string>).id,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        description: trunc(tx.description),
        category_name: tx.category_id ? (catMap.get(tx.category_id) ?? tx.category_id) : null,
        person_name: tx.person_id ? (personMap.get(tx.person_id)?.name ?? tx.person_id) : null,
      }));

    // ── upcomingCommitments ───────────────────────────────────────────────────
    const cutoff14 = addDays(end, 14);
    type Commitment = { type: string; id: string; label: string; amount: number; due_date: string; person_id?: string | null };
    const upcoming: Commitment[] = [];

    for (const sp of scheduledArr as Array<Record<string, unknown>>) {
      const due = sp.due_date as string;
      if (!due || due > cutoff14) continue;
      if ((sp.status as string) === 'paid') continue;
      upcoming.push({ type: 'scheduled', id: sp.id as string, label: trunc(sp.description as string), amount: sp.amount as number, due_date: due, person_id: (sp.person_id as string) ?? null });
    }
    for (const mp of msiArr as Array<Record<string, unknown>>) {
      const due = mp.due_date as string;
      if (!due || due > cutoff14) continue;
      if (mp.paid) continue;
      upcoming.push({ type: 'msi', id: mp.id as string, label: trunc(mp.label as string ?? mp.description as string), amount: mp.amount as number, due_date: due, person_id: (mp.person_id as string) ?? null });
    }
    for (const ip of investmentArr as Array<Record<string, unknown>>) {
      const due = (ip.due_date ?? ip.payment_date ?? ip.date) as string | undefined;
      if (!due || due > cutoff14) continue;
      if (ip.paid || ip.status === 'paid') continue;
      upcoming.push({ type: 'investment', id: ip.id as string, label: trunc((ip.description ?? ip.label) as string), amount: ip.amount as number, due_date: due, person_id: (ip.person_id as string) ?? null });
    }
    for (const rp of rentalArr as Array<Record<string, unknown>>) {
      const due = (rp.due_date ?? rp.expected_date ?? rp.date) as string | undefined;
      if (!due || due > cutoff14) continue;
      if (rp.paid || rp.status === 'paid') continue;
      upcoming.push({ type: 'rental', id: rp.id as string, label: trunc((rp.description ?? rp.label) as string), amount: rp.amount as number, due_date: due, person_id: (rp.person_id as string) ?? null });
    }

    upcoming.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));
    const upcomingCommitments = upcoming.slice(0, 10);

    // ── budgetHints ───────────────────────────────────────────────────────────
    let budgetHints: { monthlyAvgExpense: number; suggestedBudget: number; lastMonths: Array<{ ym: string; expense: number }> };
    try {
      const bg = await base44.functions.invoke('getBudgetSuggestion', { familyId });
      const totalSuggested = bg?.total_suggested_budget ?? 0;
      const avgIncome = bg?.avg_monthly_income ?? 0;
      budgetHints = { monthlyAvgExpense: avgIncome, suggestedBudget: totalSuggested, lastMonths: [] };
    } catch {
      // Fallback: compute from the last 3 months manually.
      const lastMonths: Array<{ ym: string; expense: number }> = [];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
        const mStart = toISODate(d);
        const mEnd = toISODate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
        try {
          const { transactions: mTxs } = await fetchAllTransactions(base44, { familyId, start: mStart, end: mEnd });
          lastMonths.push({ ym: mStart.slice(0, 7), expense: sumByType(mTxs).expense });
        } catch {
          lastMonths.push({ ym: mStart.slice(0, 7), expense: 0 });
        }
      }
      const monthlyAvgExpense = lastMonths.length
        ? Math.round(lastMonths.reduce((s, m) => s + m.expense, 0) / lastMonths.length)
        : 0;
      budgetHints = { monthlyAvgExpense, suggestedBudget: Math.round(monthlyAvgExpense * 1.1), lastMonths };
    }

    // ── smartRules ────────────────────────────────────────────────────────────
    const smartRules = (familyConfigArr as Array<Record<string, unknown>>)[0]?.smart_rules ?? null;

    // ── Response ──────────────────────────────────────────────────────────────
    return Response.json({
      user: userOut,
      person: personOut,
      family: familyOut,
      members: membersOut,
      month: {
        period: { start, end, label },
        income: totals.income,
        expense: totals.expense,
        balance: totals.balance,
        byPerson,
        topCategories,
      },
      upcomingCommitments,
      budgetHints,
      recentTransactions,
      smartRules,
      truncated,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    const httpStatus = (error as Record<string, number>).httpStatus;
    if (httpStatus === 403) return Response.json({ error: 'forbidden' }, { status: 403 });
    if (httpStatus === 401) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('getAssistantContext error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
