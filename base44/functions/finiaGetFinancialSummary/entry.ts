import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function sumByType(txs, excludedCatIds) {
  let expense = 0, income = 0;
  for (const tx of txs) {
    if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
    if (tx.category_id && excludedCatIds.has(tx.category_id)) continue;
    if (tx.type === 'expense') expense += tx.amount;
    else if (tx.type === 'income') income += tx.amount;
  }
  return { expense, income, balance: income - expense };
}

async function fetchTxsForPeriod(entities, familyId, start, end) {
  const PAGE = 200;
  const MAX = 500;
  let all = [];
  let skip = 0;
  while (true) {
    const page = await entities.Transaction.filter({ family_id: familyId }, '-date', PAGE, skip);
    if (!page || page.length === 0) break;
    let done = false;
    for (const tx of page) {
      if (!tx.date) continue;
      if (tx.date > end) continue;
      if (tx.date < start) { done = true; break; }
      all.push(tx);
      if (all.length >= MAX) { done = true; break; }
    }
    if (done || page.length < PAGE) break;
    skip += PAGE;
  }
  return all;
}

// Returns the financial summary for the authenticated user's family.
// Resolves family_id server-side — never trusts client input.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const entities = base44.asServiceRole.entities;

    let memberships = await entities.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) memberships = await entities.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    if (!memberships.length) return Response.json({ error: 'forbidden' }, { status: 403 });

    const activeId = user.data?.family_id ?? user.data?.data?.family_id;
    const membership = memberships.find(m => m.family_id === activeId)
      ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
    const familyId = membership.family_id;

    const body = await req.json().catch(() => ({}));
    const period = body.period ?? 'current_month';

    const today = new Date();
    const todayISO = toISODate(today);

    let start, end, periodLabel;
    if (period === 'previous_month') {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      start = toISODate(d);
      end = toISODate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)));
      periodLabel = `${d.toLocaleString('es-MX', { month: 'long' })} ${d.getFullYear()}`;
    } else if (period === 'last_3_months') {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1));
      start = toISODate(d);
      end = todayISO;
      periodLabel = 'Últimos 3 meses';
    } else {
      // current_month (default)
      start = toISODate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
      end = todayISO;
      periodLabel = `${today.toLocaleString('es-MX', { month: 'long' })} ${today.getFullYear()}`;
    }

    const [txs, categoriesArr, personsArr] = await Promise.all([
      fetchTxsForPeriod(entities, familyId, start, end),
      entities.Category.filter({ family_id: familyId }).catch(() => []),
      entities.Person.filter({ family_id: familyId }).catch(() => []),
    ]);

    const excludedCatIds = new Set(
      (categoriesArr || []).filter(c => c.exclude_from_totals).map(c => c.id)
    );
    const catMap = new Map((categoriesArr || []).map(c => [c.id, c.name ?? c.id]));
    const personMap = new Map((personsArr || []).map(p => [p.id, p.name ?? p.id]));

    const totals = sumByType(txs, excludedCatIds);

    // Top categories
    const catAgg = new Map();
    for (const tx of txs) {
      if (tx.type !== 'expense' || !tx.category_id) continue;
      if (excludedCatIds.has(tx.category_id)) continue;
      const e = catAgg.get(tx.category_id) ?? { total: 0, count: 0 };
      e.total += tx.amount || 0;
      e.count++;
      catAgg.set(tx.category_id, e);
    }
    const topCategories = Array.from(catAgg.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6)
      .map(([catId, agg]) => ({
        name: catMap.get(catId) ?? 'Sin categoría',
        total: agg.total,
        count: agg.count,
      }));

    // Breakdown by person
    const personAgg = new Map();
    for (const tx of txs) {
      if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
      if (excludedCatIds.has(tx.category_id)) continue;
      const key = tx.person_id ?? '__none__';
      const e = personAgg.get(key) ?? { expense: 0, income: 0 };
      if (tx.type === 'expense') e.expense += tx.amount;
      else if (tx.type === 'income') e.income += tx.amount;
      personAgg.set(key, e);
    }
    const byPerson = Array.from(personAgg.entries())
      .map(([pid, agg]) => ({
        name: pid === '__none__' ? 'Sin asignar' : (personMap.get(pid) ?? 'Desconocido'),
        expense: agg.expense,
        income: agg.income,
      }))
      .sort((a, b) => b.expense - a.expense);

    // Recent transactions (safe — no internal IDs returned to agent)
    const recent = [...txs]
      .sort((a, b) => (b.date > a.date ? 1 : -1))
      .slice(0, 8)
      .map(tx => ({
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        description: tx.description ? String(tx.description).slice(0, 80) : null,
        category_name: tx.category_id ? (catMap.get(tx.category_id) ?? null) : null,
        person_name: tx.person_id ? (personMap.get(tx.person_id) ?? null) : null,
      }));

    return Response.json({
      period: { start, end, label: periodLabel },
      income: totals.income,
      expense: totals.expense,
      balance: totals.balance,
      top_categories: topCategories,
      by_person: byPerson,
      recent_transactions: recent,
      transaction_count: txs.length,
    });
  } catch (error) {
    console.error('finiaGetFinancialSummary error:', error);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});