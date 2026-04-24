import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function trunc(s, max = 80) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

function sumByType(txs) {
  let expense = 0, income = 0;
  for (const tx of txs) {
    if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
    if (tx.type === 'expense') expense += tx.amount;
    else if (tx.type === 'income') income += tx.amount;
  }
  return { expense, income, balance: income - expense };
}

async function fetchTransactions(entities, familyId, start, end) {
  const PAGE = 200;
  let all = [];
  let skip = 0;
  let truncated = false;
  while (true) {
    const page = await entities.Transaction.filter(
      { family_id: familyId, date: { $gte: start, $lte: end } },
      '-date',
      PAGE,
      skip
    );
    all = all.concat(page || []);
    if (!page || page.length < PAGE) break;
    skip += PAGE;
    if (all.length >= 2000) { truncated = true; break; }
  }
  return { transactions: all, truncated };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { familyId, personId: rawPersonId, locale: _locale } = body;

    if (!familyId) {
      return Response.json({ error: 'familyId required' }, { status: 400 });
    }

    // Auth check
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const entities = base44.asServiceRole.entities;

    const today = new Date();
    const start = toISODate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
    const end = toISODate(today);

    // Parallel fetches
    const [
      familyArr,
      membershipsArr,
      personsArr,
      categoriesArr,
      txResult,
      scheduledArr,
      familyConfigArr,
    ] = await Promise.all([
      entities.Family.filter({ id: familyId }),
      entities.FamilyMembership.filter({ family_id: familyId, status: 'approved' }),
      entities.Person.filter({ family_id: familyId }),
      entities.Category.filter({ family_id: familyId }),
      fetchTransactions(entities, familyId, start, end),
      (async () => { try { return await entities.ScheduledPayment.filter({ family_id: familyId, is_active: true }); } catch { return []; } })(),
      (async () => { try { return await entities.FamilyConfig.filter({ family_id: familyId }); } catch { return []; } })(),
    ]);

    const { transactions: txs, truncated } = txResult;

    // Family
    const fam = (familyArr || [])[0] ?? {};
    const familyOut = {
      id: fam.id,
      name: fam.name,
      currency: fam.currency || 'MXN',
      currency_symbol: fam.currency_symbol || '$',
      plan: fam.license_plan,
      billing_status: fam.billing_status,
    };

    // Person
    let personId = rawPersonId ?? null;
    let personOut = null;
    if (personId) {
      const found = (personsArr || []).find((p) => p.id === personId && p.family_id === familyId);
      if (!found) personId = null;
      else personOut = { id: found.id, name: found.name ?? found.id };
    }

    // Members
    const personMap = new Map((personsArr || []).map((p) => [p.id, p]));
    const membersOut = [];
    const seenPersonIds = new Set();

    for (const ms of (membershipsArr || [])) {
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
    for (const p of (personsArr || [])) {
      if (!seenPersonIds.has(p.id)) {
        membersOut.push({ person_id: p.id, name: p.name ?? p.id, role: null, linked_user_email: null });
      }
    }

    // Month aggregations
    const totals = sumByType(txs);

    const personAggMap = new Map();
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

    const catMap = new Map((categoriesArr || []).map((c) => [c.id, c.name ?? c.id]));

    // Top categories
    const catAgg = new Map();
    for (const tx of txs) {
      if (tx.type !== 'expense' || !tx.category_id) continue;
      const e = catAgg.get(tx.category_id) ?? { total: 0, count: 0 };
      e.total += tx.amount || 0;
      e.count++;
      catAgg.set(tx.category_id, e);
    }
    const topCategories = Array.from(catAgg.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([catId, agg]) => ({
        category_id: catId,
        name: catMap.get(catId) ?? catId,
        total: agg.total,
        count: agg.count,
      }));

    // Recent transactions
    const recentTransactions = [...txs]
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
      .slice(0, 10)
      .map((tx) => ({
        id: tx.id,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        description: trunc(tx.description),
        category_name: tx.category_id ? (catMap.get(tx.category_id) ?? tx.category_id) : null,
        person_name: tx.person_id ? (personMap.get(tx.person_id)?.name ?? tx.person_id) : null,
      }));

    // Upcoming commitments (next 14 days)
    const cutoff14 = addDays(end, 14);
    const upcoming = [];

    // Scheduled payments — check which ones are NOT paid this month
    const currentMonth = end.slice(0, 7); // YYYY-MM
    let paidScheduledIds = new Set();
    try {
      const paidRecords = await entities.ScheduledPaymentRecord.filter({ family_id: familyId, month: currentMonth });
      for (const r of (paidRecords || [])) paidScheduledIds.add(r.scheduled_payment_id);
    } catch { /* ignore */ }

    for (const sp of (scheduledArr || [])) {
      if (!sp.is_active) continue;
      if (paidScheduledIds.has(sp.id)) continue;
      const dueDay = sp.due_day;
      if (!dueDay) continue;
      const dueDate = `${currentMonth}-${String(dueDay).padStart(2, '0')}`;
      if (dueDate > cutoff14) continue;
      upcoming.push({
        type: 'scheduled',
        id: sp.id,
        label: sp.name || sp.description || '—',
        amount: sp.amount || 0,
        due_date: dueDate,
      });
    }

    upcoming.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));

    const smartRules = (familyConfigArr || [])[0]?.smart_rules ?? null;

    return Response.json({
      user: { id: user.id, email: user.email, name: user.full_name || user.email },
      person: personOut,
      family: familyOut,
      members: membersOut,
      month: {
        period: { start, end, label: start.slice(0, 7) },
        income: totals.income,
        expense: totals.expense,
        balance: totals.balance,
        byPerson,
        topCategories,
      },
      upcomingCommitments: upcoming.slice(0, 10),
      recentTransactions,
      smartRules,
      truncated,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('getAssistantContext error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
});