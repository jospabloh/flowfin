import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// IMPORTANT: base44.asServiceRole does NOT bypass RLS for family-scoped entities
// in the backend function runtime ({{user.data.family_id}} template resolves to empty).
// Use base44.entities (user-context) for ALL family-scoped reads.
// Only use asServiceRole for FamilyMembership and Family (have admin/user.id RLS paths).

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

// Paginated transaction fetch using user-context client
async function fetchTxsForPeriod(userEntities, familyId, start, end) {
  const PAGE = 200;
  const MAX = 1000;
  const all = [];
  let skip = 0;
  while (true) {
    const page = await userEntities.Transaction.filter({ family_id: familyId }, '-date', PAGE, skip);
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { familyId: bodyFamilyId, personId: rawPersonId } = body;

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve family from server-side session — never trust body.familyId alone
    const sr = base44.asServiceRole.entities;
    const ue = base44.entities; // user-context for family-scoped entities

    let memberships = await sr.FamilyMembership.filter({ user_id: user.id, status: 'approved' });
    if (!memberships.length) memberships = await sr.FamilyMembership.filter({ user_email: user.email, status: 'approved' });
    if (!memberships.length) return Response.json({ error: 'forbidden' }, { status: 403 });

    // If body provides a familyId, verify the user is a member of it
    let familyId;
    if (bodyFamilyId) {
      const found = memberships.find(m => m.family_id === bodyFamilyId);
      if (!found) return Response.json({ error: 'forbidden' }, { status: 403 });
      familyId = bodyFamilyId;
    } else {
      const activeId = user.data?.family_id ?? user.data?.data?.family_id;
      const membership = memberships.find(m => m.family_id === activeId)
        ?? [...memberships].sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''))[0];
      familyId = membership.family_id;
    }

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

    console.log('[getAssistantContext] familyId:', familyId, 'user:', user.email);

    // Parallel fetches — user-context for all family-scoped entities
    const [
      familiesArr,
      membershipsArr,
      personsArr,
      categoriesArr,
      txs,
      prevTxs,
      twoMonthsTxs,
      scheduledArr,
      msiArr,
      investmentsArr,
      rentalPropertiesArr,
    ] = await Promise.all([
      sr.Family.filter({ id: familyId }).catch(() => []),
      sr.FamilyMembership.filter({ family_id: familyId, status: 'approved' }).catch(() => []),
      ue.Person.filter({ family_id: familyId }).catch(() => []),
      ue.Category.filter({ family_id: familyId }).catch(() => []),
      fetchTxsForPeriod(ue, familyId, monthStart, todayISO),
      fetchTxsForPeriod(ue, familyId, prevMonthStart, prevMonthEnd),
      fetchTxsForPeriod(ue, familyId, twoMonthsStart, twoMonthsEnd),
      ue.ScheduledPayment.filter({ family_id: familyId, is_active: true }).catch(() => []),
      ue.MSI.filter({ family_id: familyId, is_active: true }).catch(() => []),
      ue.Investment.filter({ family_id: familyId, is_active: true }).catch(() => []),
      ue.RentalProperty.filter({ family_id: familyId, is_active: true }).catch(() => []),
    ]);

    console.log('[getAssistantContext] txs:', txs.length, 'prevTxs:', prevTxs.length, 'categories:', categoriesArr.length);

    const familyRecord = familiesArr?.[0] ?? {};

    // Family output
    const familyOut = {
      id: familyRecord.id,
      name: familyRecord.name,
      currency: familyRecord.currency || 'MXN',
      currency_symbol: familyRecord.currency_symbol || '$',
      plan: familyRecord.license_plan,
      billing_status: familyRecord.billing_status,
    };

    // Person
    let personId = rawPersonId ?? null;
    let personOut = null;
    const personMap = new Map((personsArr || []).map(p => [p.id, p]));
    if (personId) {
      const found = (personsArr || []).find(p => p.id === personId && p.family_id === familyId);
      if (!found) personId = null;
      else personOut = { id: found.id, name: found.name ?? found.id };
    }

    // Members
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

    const catMap = new Map((categoriesArr || []).map(c => [c.id, c.name ?? c.id]));

    // Current month aggregations
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

    // Previous month aggregations
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

    // Two months ago
    const twoMonthsTotals = sumByType(twoMonthsTxs);

    // Category deltas
    const categoryDeltas = [];
    for (const [catId, curr] of catAgg.entries()) {
      const prev = prevCatAgg.get(catId);
      if (!prev) continue;
      const delta = curr.total - prev.total;
      const pct = prev.total > 0 ? Math.round((delta / prev.total) * 100) : null;
      if (Math.abs(delta) > 50) {
        categoryDeltas.push({ name: catMap.get(catId) ?? catId, current: curr.total, previous: prev.total, delta, pct });
      }
    }
    categoryDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    // Recent transactions
    const recentTransactions = [...txs]
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
      .slice(0, 10)
      .map(tx => ({
        id: tx.id,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        description: trunc(tx.description),
        category_name: tx.category_id ? (catMap.get(tx.category_id) ?? tx.category_id) : null,
        person_name: tx.person_id ? (personMap.get(tx.person_id)?.name ?? tx.person_id) : null,
      }));

    // Upcoming commitments (next 14 days)
    const cutoff14 = addDays(todayISO, 14);
    const upcoming = [];
    const currentMonth = todayISO.slice(0, 7);

    // ScheduledPaymentRecord — use user-context
    const paidScheduledIds = new Set();
    try {
      const paidRecords = await ue.ScheduledPaymentRecord.filter({ family_id: familyId, month: currentMonth });
      for (const r of (paidRecords || [])) paidScheduledIds.add(r.scheduled_payment_id);
    } catch { /* ignore */ }

    for (const sp of (scheduledArr || [])) {
      if (!sp.is_active) continue;
      if (paidScheduledIds.has(sp.id)) continue;
      const dueDay = sp.due_day;
      if (!dueDay) continue;
      const dueDate = `${currentMonth}-${String(dueDay).padStart(2, '0')}`;
      if (dueDate > cutoff14) continue;
      upcoming.push({ type: 'scheduled', id: sp.id, label: sp.name || sp.description || '—', amount: sp.amount || 0, due_date: dueDate });
    }
    upcoming.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));

    // Active commitments
    const activeMSI = (msiArr || []).map(m => ({
      store: m.store, monthly_amount: m.monthly_amount, total_months: m.total_months,
      start_date: m.start_date, concept: m.concept,
    }));
    const activeInvestments = (investmentsArr || []).map(i => ({
      name: i.name, type: i.type, payment_amount: i.payment_amount,
      total_payments: i.total_payments, start_date: i.start_date, payment_day: i.payment_day,
    }));
    const activeRentals = (rentalPropertiesArr || []).map(r => ({
      name: r.name, tenant_name: r.tenant_name, base_rent: r.base_rent, payment_day: r.payment_day,
    }));

    // Conversation history — try user-context first for ConversationSession
    let conversationHistory = [];
    try {
      const recentSessions = await ue.ConversationSession.filter(
        { family_id: familyId, user_id: user.id },
        '-session_date',
        3
      ).catch(() => sr.ConversationSession.filter({ family_id: familyId, user_id: user.id }, '-session_date', 3));
      conversationHistory = (recentSessions || []).map(s => {
        const excerpt = s.summary || `${s.message_count || 0} mensajes`;
        const ch = s.channel === 'whatsapp' ? 'WhatsApp' : 'app';
        return `${s.session_date} [${ch}]: ${excerpt}`;
      });
    } catch { /* continue without history */ }

    return Response.json({
      user: { id: user.id, email: user.email, name: user.full_name || user.email },
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
      conversationHistory,
      truncated: txs.length >= 1000,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('getAssistantContext error:', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
});