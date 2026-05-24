import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function assertFamilyMember(base44, familyId) {
  const user = await base44.auth.me();
  if (!user) { const err = new Error('Unauthorized'); err.httpStatus = 401; throw err; }
  if (user.role === 'admin') return { user, membership: null };
  let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_id: user.id, family_id: familyId, status: 'approved' });
  if (!memberships.length) memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_email: user.email, family_id: familyId, status: 'approved' });
  if (!memberships.length) { const err = new Error('forbidden'); err.httpStatus = 403; throw err; }
  return { user, membership: memberships[0] };
}

function errorResponse(err) {
  const status = (err && err.httpStatus) || 500;
  const message = status === 500 ? 'internal' : err?.message || 'error';
  return Response.json({ error: message }, { status });
}

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
  try {
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
  } catch (e) {
    console.error('[fetchTransactions] ERROR:', e?.message, 'familyId:', familyId, 'range:', start, '-', end);
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

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Reject access to a family the caller isn't an approved member of.
    try {
      await assertFamilyMember(base44, familyId);
    } catch (e) {
      return errorResponse(e);
    }

    const entities = base44.asServiceRole.entities;

    const today = new Date();
    const todayISO = toISODate(today);

    // Current month
    const monthStart = toISODate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));

    // Previous month
    const prevMonthDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const prevMonthStart = toISODate(prevMonthDate);
    const prevMonthEnd = toISODate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)));

    // Two months ago
    const twoMonthsDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1));
    const twoMonthsStart = toISODate(twoMonthsDate);
    const twoMonthsEnd = toISODate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 0)));

    // Parallel fetches
    const [
      familyRecord,
      membershipsArr,
      personsArr,
      categoriesArr,
      txResult,
      prevTxResult,
      twoMonthsTxResult,
      scheduledArr,
      familyConfigArr,
      msiArr,
      investmentsArr,
      rentalPropertiesArr,
    ] = await Promise.all([
      entities.Family.get(familyId).catch(() => null),
      entities.FamilyMembership.filter({ family_id: familyId, status: 'approved' }),
      entities.Person.filter({ family_id: familyId }),
      entities.Category.filter({ family_id: familyId }),
      fetchTransactions(entities, familyId, monthStart, todayISO),
      fetchTransactions(entities, familyId, prevMonthStart, prevMonthEnd),
      fetchTransactions(entities, familyId, twoMonthsStart, twoMonthsEnd),
      (async () => { try { return await entities.ScheduledPayment.filter({ family_id: familyId, is_active: true }); } catch { return []; } })(),
      (async () => { try { return await entities.FamilyConfig.filter({ family_id: familyId }); } catch { return []; } })(),
      (async () => { try { return await entities.MSI.filter({ family_id: familyId, is_active: true }); } catch { return []; } })(),
      (async () => { try { return await entities.Investment.filter({ family_id: familyId, is_active: true }); } catch { return []; } })(),
      (async () => { try { return await entities.RentalProperty.filter({ family_id: familyId, is_active: true }); } catch { return []; } })(),
    ]);

    const { transactions: txs, truncated } = txResult;
    const { transactions: prevTxs } = prevTxResult;
    const { transactions: twoMonthsTxs } = twoMonthsTxResult;

    console.log('[getAssistantContext] txs:', txs.length, 'prevTxs:', prevTxs.length, 'family:', familyRecord?.name);

    // Family
    const fam = familyRecord ?? {};
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

    const catMap = new Map((categoriesArr || []).map((c) => [c.id, c.name ?? c.id]));

    // ── Current month aggregations ──────────────────────────────────────────
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

    // Top categories current month
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

    // ── Previous month aggregations ─────────────────────────────────────────
    const prevTotals = sumByType(prevTxs);
    const prevCatAgg = new Map();
    for (const tx of prevTxs) {
      if (tx.type !== 'expense' || !tx.category_id) continue;
      const e = prevCatAgg.get(tx.category_id) ?? { total: 0, count: 0 };
      e.total += tx.amount || 0;
      e.count++;
      prevCatAgg.set(tx.category_id, e);
    }
    const prevTopCategories = Array.from(prevCatAgg.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([catId, agg]) => ({
        name: catMap.get(catId) ?? catId,
        total: agg.total,
        count: agg.count,
      }));

    // ── Two months ago aggregations ─────────────────────────────────────────
    const twoMonthsTotals = sumByType(twoMonthsTxs);

    // ── Comparative analysis ────────────────────────────────────────────────
    // Category deltas: this month vs previous month
    const categoryDeltas = [];
    for (const [catId, curr] of catAgg.entries()) {
      const prev = prevCatAgg.get(catId);
      if (!prev) continue;
      const delta = curr.total - prev.total;
      const pct = prev.total > 0 ? Math.round((delta / prev.total) * 100) : null;
      if (Math.abs(delta) > 50) { // only significant changes
        categoryDeltas.push({
          name: catMap.get(catId) ?? catId,
          current: curr.total,
          previous: prev.total,
          delta,
          pct,
        });
      }
    }
    categoryDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    // ── Recent transactions ─────────────────────────────────────────────────
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

    // ── Upcoming commitments (next 14 days) ─────────────────────────────────
    const cutoff14 = addDays(todayISO, 14);
    const upcoming = [];

    const currentMonth = todayISO.slice(0, 7);
    const paidScheduledIds = new Set();
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

    // ── Active financial commitments summary ────────────────────────────────
    const activeMSI = (msiArr || []).map(m => ({
      store: m.store,
      monthly_amount: m.monthly_amount,
      total_months: m.total_months,
      start_date: m.start_date,
      concept: m.concept,
    }));

    const activeInvestments = (investmentsArr || []).map(i => ({
      name: i.name,
      type: i.type,
      payment_amount: i.payment_amount,
      total_payments: i.total_payments,
      start_date: i.start_date,
      payment_day: i.payment_day,
    }));

    const activeRentals = (rentalPropertiesArr || []).map(r => ({
      name: r.name,
      tenant_name: r.tenant_name,
      base_rent: r.base_rent,
      payment_day: r.payment_day,
    }));

    const smartRules = (familyConfigArr || [])[0]?.smart_rules ?? null;

    // ── Historial de conversaciones recientes (últimas 3 sesiones archivadas) ──
    let conversationHistory = [];
    try {
      const recentSessions = await base44.asServiceRole.entities.ConversationSession.filter(
        { family_id: familyId, user_id: user.id },
        '-session_date',
        3
      );
      conversationHistory = recentSessions.map(s => {
        const excerpt = s.summary || `${s.message_count || 0} mensajes`;
        const ch = s.channel === 'whatsapp' ? 'WhatsApp' : 'app';
        return `${s.session_date} [${ch}]: ${excerpt}`;
      });
    } catch {
      // Si ConversationSession no existe aún o hay error, seguimos sin historial
    }

    return Response.json({
      user: user ? { id: user.id, email: user.email, name: user.full_name || user.email } : { id: null, email: null, name: 'Usuario' },
      person: personOut,
      family: familyOut,
      members: membersOut,
      month: {
        period: { start: monthStart, end: todayISO, label: monthStart.slice(0, 7) },
        income: totals.income,
        expense: totals.expense,
        balance: totals.balance,
        byPerson,
        topCategories,
      },
      previousMonth: {
        period: { start: prevMonthStart, end: prevMonthEnd, label: prevMonthStart.slice(0, 7) },
        income: prevTotals.income,
        expense: prevTotals.expense,
        balance: prevTotals.balance,
        topCategories: prevTopCategories,
      },
      twoMonthsAgo: {
        period: { start: twoMonthsStart, end: twoMonthsEnd, label: twoMonthsStart.slice(0, 7) },
        income: twoMonthsTotals.income,
        expense: twoMonthsTotals.expense,
        balance: twoMonthsTotals.balance,
      },
      trends: {
        expenseDelta: totals.expense - prevTotals.expense,
        expenseDeltaPct: prevTotals.expense > 0 ? Math.round(((totals.expense - prevTotals.expense) / prevTotals.expense) * 100) : null,
        incomeDelta: totals.income - prevTotals.income,
        categoryDeltas: categoryDeltas.slice(0, 5),
      },
      upcomingCommitments: upcoming.slice(0, 10),
      recentTransactions,
      activeCommitments: {
        msi: activeMSI,
        investments: activeInvestments,
        rentals: activeRentals,
        scheduledPayments: (scheduledArr || []).map(sp => ({ name: sp.name, amount: sp.amount, due_day: sp.due_day })),
      },
      smartRules,
      conversationHistory,
      truncated,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('getAssistantContext error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
});