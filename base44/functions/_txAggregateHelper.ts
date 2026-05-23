// Shared pure utilities for transaction-aggregate functions (server-side Deno, no src/ imports).

// ─── Types ────────────────────────────────────────────────────────────────────

export type TxType = 'expense' | 'income' | 'all';

export interface AggregateFilters {
  familyId: string;
  start?: string;          // 'YYYY-MM-DD' inclusive
  end?: string;            // 'YYYY-MM-DD' inclusive
  type?: TxType;           // default 'all'
  personId?: string;
  categoryId?: string;
  subcategoryId?: string;
  paymentMethodId?: string;
}

// Minimal shape — only the fields we reference in helpers.
export interface Transaction {
  family_id: string;
  date: string;
  type: 'expense' | 'income';
  amount: number;
  description?: string;
  category_id?: string;
  subcategory_id?: string;
  person_id?: string;
  payment_method_id?: string;
  notes?: string;
  week?: number;
  required_type?: string;
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

// Verifies the authenticated user is an approved member of familyId; throws on failure.
export async function assertFamilyMember(
  // deno-lint-ignore no-explicit-any
  base44: any,
  familyId: string,
): Promise<{ user: unknown; membership: unknown }> {
  const user = await base44.auth.me();
  if (!user) {
    const err = new Error('Unauthorized');
    (err as unknown as Record<string, number>).httpStatus = 401;
    throw err;
  }

  let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
    user_id: (user as Record<string, string>).id,
    family_id: familyId,
    status: 'approved',
  });

  if (!memberships.length) {
    memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_email: (user as Record<string, string>).email,
      family_id: familyId,
      status: 'approved',
    });
  }

  if (!memberships.length) {
    const err = new Error('forbidden');
    (err as unknown as Record<string, number>).httpStatus = 403;
    throw err;
  }

  return { user, membership: memberships[0] };
}

// ─── Access resolution (auth-tolerant: web session, in-app agent, WhatsApp) ─────

export interface ResolvedAccess {
  // deno-lint-ignore no-explicit-any
  user: any | null;
  familyId: string;
  selfPersonId: string | null;
  // deno-lint-ignore no-explicit-any
  membership: any | null;
}

// Resolves the caller's family and own person without hard-failing on a missing
// browser session. Works for three call contexts:
//   1. Frontend SDK call — auth.me() resolves; familyId is validated against the
//      user's approved memberships.
//   2. Agent tool call (in-app chat or WhatsApp) — auth.me() resolves to the
//      linked user; familyId may be omitted and is then taken from membership.
//   3. Direct HTTP / service role — no user; familyId is required and trusted.
// When an authenticated user is present they MUST be an approved member of the
// resolved family, so a hallucinated or cross-family familyId is rejected (403).
export async function resolveAccess(
  // deno-lint-ignore no-explicit-any
  base44: any,
  requestedFamilyId?: string,
): Promise<ResolvedAccess> {
  // deno-lint-ignore no-explicit-any
  let user: any = null;
  try {
    user = await base44.auth.me();
  } catch {
    user = null;
  }

  if (user) {
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
      user_id: user.id,
      status: 'approved',
    });
    if (!memberships.length) {
      memberships = await base44.asServiceRole.entities.FamilyMembership.filter({
        user_email: user.email,
        status: 'approved',
      });
    }
    if (!memberships.length) {
      const err = new Error('forbidden');
      (err as unknown as Record<string, number>).httpStatus = 403;
      throw err;
    }

    let membership = memberships[0];
    if (!requestedFamilyId && memberships.length > 1) {
      const activeId = (user as any).data?.family_id ?? (user as any).data?.data?.family_id;
      membership =
        memberships.find((m: any) => m.family_id === activeId) ??
        [...memberships].sort((a: any, b: any) =>
          (b.last_active_at ?? '').localeCompare(a.last_active_at ?? '')
        )[0];
    }
    if (requestedFamilyId) {
      const match = memberships.find(
        // deno-lint-ignore no-explicit-any
        (m: any) => m.family_id === requestedFamilyId,
      );
      if (!match) {
        const err = new Error('forbidden');
        (err as unknown as Record<string, number>).httpStatus = 403;
        throw err;
      }
      membership = match;
    }

    return {
      user,
      familyId: membership.family_id,
      selfPersonId: membership.person_id ?? null,
      membership,
    };
  }

  // No authenticated user: only reachable via direct HTTP / service role.
  if (!requestedFamilyId) {
    // No auth and no familyId → WhatsApp session expired or not linked
    const err: any = new Error('whatsapp_session_expired');
    err.httpStatus = 401;
    err.code = 'not_linked';
    throw err;
  }
  return { user: null, familyId: requestedFamilyId, selfPersonId: null, membership: null };
}

// Resolves the effective person filter from an explicit personId and/or a scope
// hint. Returns undefined to mean "whole family" (no person filter).
//   - personId (a real id)        → that person
//   - personId === 'self' or
//     scope === 'self'/'me'/'mine' → the caller's own person
//   - scope 'family'/'all'/none   → undefined (whole family)
export function resolvePersonFilter(
  access: ResolvedAccess,
  opts: { personId?: string; scope?: string },
): string | undefined {
  const personId = opts.personId?.trim();
  const scope = opts.scope?.trim().toLowerCase();
  if (personId && personId !== 'self') return personId;
  if (personId === 'self' || scope === 'self' || scope === 'me' || scope === 'mine') {
    return access.selfPersonId ?? undefined;
  }
  return undefined;
}

// Maps a thrown error (optionally carrying httpStatus) to a JSON Response.
// deno-lint-ignore no-explicit-any
export function errorResponse(err: any): Response {
  const status = (err && err.httpStatus) || 500;
  const message = status === 500 ? 'internal' : err?.message || 'error';
  return Response.json({ error: message }, { status });
}

// ─── Fetch all transactions with pagination ────────────────────────────────────

const PAGE_SIZE = 2000;
const HARD_CAP = 50000;

// Fetches all matching transactions in 2000-record pages; caps at 50000 and signals truncation.
export async function fetchAllTransactions(
  // deno-lint-ignore no-explicit-any
  base44: any,
  filters: AggregateFilters,
): Promise<{ transactions: Transaction[]; truncated: boolean }> {
  const queryFilter: Record<string, unknown> = { family_id: filters.familyId };

  if (filters.type && filters.type !== 'all') queryFilter.type = filters.type;
  if (filters.personId) queryFilter.person_id = filters.personId;
  if (filters.categoryId) queryFilter.category_id = filters.categoryId;
  if (filters.subcategoryId) queryFilter.subcategory_id = filters.subcategoryId;
  if (filters.paymentMethodId) queryFilter.payment_method_id = filters.paymentMethodId;
  if (filters.start) queryFilter.date_gte = filters.start;
  if (filters.end) queryFilter.date_lte = filters.end;

  const all: Transaction[] = [];
  let offset = 0;
  let truncated = false;

  while (true) {
    const page: Transaction[] = await base44.asServiceRole.entities.Transaction.filter(
      queryFilter,
      'date',
      PAGE_SIZE,
      offset,
    );

    all.push(...page);

    if (all.length >= HARD_CAP) {
      truncated = true;
      break;
    }

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { transactions: all.slice(0, HARD_CAP), truncated };
}

// ─── Aggregation helpers ───────────────────────────────────────────────────────

// Sums expense / income amounts and computes balance; ignores malformed entries.
export function sumByType(
  txs: Transaction[],
): { expense: number; income: number; balance: number; count: number } {
  let expense = 0;
  let income = 0;
  let count = 0;

  for (const tx of txs) {
    if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
    count++;
    if (tx.type === 'expense') expense += tx.amount;
    else if (tx.type === 'income') income += tx.amount;
  }

  return { expense, income, balance: income - expense, count };
}

// Groups transactions by keyFn result and sums amounts; returns array sorted desc by total.
export function groupSum<K extends string>(
  txs: Transaction[],
  keyFn: (tx: Transaction) => K | null,
  amountFilter?: 'expense' | 'income',
): Array<{ key: K; total: number; count: number }> {
  const filterType = amountFilter ?? 'expense';
  const map = new Map<K, { total: number; count: number }>();

  for (const tx of txs) {
    if (tx.type !== filterType) continue;
    if (typeof tx.amount !== 'number' || isNaN(tx.amount)) continue;
    const key = keyFn(tx);
    if (key === null) continue;
    const entry = map.get(key) ?? { total: 0, count: 0 };
    entry.total += tx.amount;
    entry.count++;
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.total - a.total);
}

// Returns the q-th quantile of a pre-sorted number array (linear interpolation).
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ─── Merchant normalizer ───────────────────────────────────────────────────────

// Known merchant slug patterns matched against lowercased description.
const MERCHANT_PATTERNS: Array<[RegExp, string]> = [
  [/walmart/i, 'walmart'],
  [/oxxo/i, 'oxxo'],
  [/chedraui/i, 'chedraui'],
  [/costco/i, 'costco'],
  [/starbucks/i, 'starbucks'],
  [/mc\s?donalds|mcdonald/i, 'mcdonalds'],
  [/pemex/i, 'pemex'],
  [/\buber\b/i, 'uber'],
  [/amazon/i, 'amazon'],
  [/mercado\s*libre/i, 'mercado libre'],
  [/7[\s-]?eleven|seven\s*eleven/i, '7-eleven'],
  [/soriana/i, 'soriana'],
  [/bodega\s*aurrer[aá]/i, 'bodega aurrera'],
];

// Removes accents, punctuation, and collapses whitespace.
function removeDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Normalizes description to a merchant slug using known patterns; falls back to cleaned lowercase.
export function normalizeMerchant(description: string): string {
  if (!description) return 'desconocido';

  for (const [pattern, slug] of MERCHANT_PATTERNS) {
    if (pattern.test(description)) return slug;
  }

  const cleaned = removeDiacritics(description)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);

  return cleaned || 'desconocido';
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

// Formats a Date to 'YYYY-MM-DD'.
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Returns the number of calendar days between two ISO dates, inclusive.
export function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const msPerDay = 86400000;
  const s = new Date(start + 'T00:00:00Z').getTime();
  const e = new Date(end + 'T00:00:00Z').getTime();
  return Math.max(0, Math.round((e - s) / msPerDay) + 1);
}
