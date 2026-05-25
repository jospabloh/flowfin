import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";
import { AgentError, agentErrorResponse, resolveAgentAccess } from "../_agentGuard.ts";
import { fetchFamilyTransactions, toISODate } from "../_txAggregateHelper.ts";

// Reads the family by id using plain .filter (the agent context does not honor
// .get(id) reliably), falling back to the user-context client.
// deno-lint-ignore no-explicit-any
async function getFamily(base44: any, familyId: string): Promise<Record<string, unknown> | null> {
  for (const ents of [base44.asServiceRole?.entities, base44.entities]) {
    if (!ents) continue;
    try {
      const arr = await ents.Family.filter({ id: familyId });
      if (arr && arr.length) return arr[0];
    } catch {
      // try next client
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const access = await resolveAgentAccess(base44, req);
    const { user, familyId, selfPersonId, membership } = access;
    const entities = base44.asServiceRole.entities;

    const today = new Date();
    const todayISO = toISODate(today);
    const monthStart = toISODate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
    const next7 = toISODate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));

    console.log("[getWhatsAppContext] familyId:", familyId, "selfPersonId:", selfPersonId ?? null);

    const [persons, fam, monthTxs, scheduledArr] = await Promise.all([
      entities.Person.filter({ family_id: familyId }).catch(() => []),
      getFamily(base44, familyId),
      fetchFamilyTransactions(base44, { familyId, start: monthStart, end: todayISO }),
      entities.ScheduledPayment.filter({ family_id: familyId, is_active: true }).catch(() => []),
    ]);

    // deno-lint-ignore no-explicit-any
    const person = (persons || []).find((p: any) => p.id === selfPersonId) ?? null;

    let income = 0;
    let expenses = 0;
    for (const tx of monthTxs) {
      if (typeof tx.amount !== "number" || isNaN(tx.amount)) continue;
      if (tx.type === "income") income += tx.amount;
      else if (tx.type === "expense") expenses += tx.amount;
    }

    console.log(
      "[getWhatsAppContext] totals — income:",
      income,
      "expenses:",
      expenses,
      "txCount:",
      monthTxs.length,
    );

    const currentMonth = todayISO.slice(0, 7);
    const upcomingPayments: Array<{ name: string; amount: number; due_date: string }> = [];
    for (const sp of (scheduledArr || [])) {
      if (!sp.is_active || !sp.due_day) continue;
      const dueDate = `${currentMonth}-${String(sp.due_day).padStart(2, "0")}`;
      if (dueDate < todayISO || dueDate > next7) continue;
      upcomingPayments.push({ name: sp.name || sp.description || "—", amount: sp.amount || 0, due_date: dueDate });
    }
    upcomingPayments.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));

    return Response.json({
      person_name: person?.name ?? membership?.user_name ?? user?.full_name ?? user?.email ?? null,
      family_name: fam?.name ?? null,
      family_id: familyId,
      person_id: selfPersonId ?? null,
      locale: "es-MX",
      current_month: {
        period: { start: monthStart, end: todayISO },
        income,
        expenses,
        balance: income - expenses,
      },
      upcoming_payments: upcomingPayments,
    });
  } catch (error) {
    if (error instanceof AgentError) return agentErrorResponse(error);
    console.error("getWhatsAppContext error:", error);
    return Response.json({ error: (error as Error).message || "internal" }, { status: 500 });
  }
});
