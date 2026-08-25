# Multi-family account switcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user approved on 2+ `Family` records see and choose which one is active, instead of the current resolver silently picking whichever approved `FamilyMembership` row comes back first.

**Architecture:** A new `switchFamily` action on the existing `family` Base44 function writes the caller's `User.data.family_id` pointer after re-deriving their approved memberships server-side. `FamilyContext.jsx`'s client-side resolver is extended to expose the full candidate list instead of truncating to one. A single `FamilySwitcher` component renders in two places — compact in `AccountSettings.jsx`, full-screen from `App.jsx`'s `FamilyGate` — both gated on `candidates.length > 1`.

**Tech Stack:** React + Vite (frontend), Base44 Deno functions (backend), `@tanstack/react-query`, Deno's built-in test runner (no external test framework — `deno.land`/`jsr.io` are blocked in this sandbox and in CI).

## Global Constraints

- No new npm/deno dependencies.
- `family/handlers/*.ts` files exported from `handlers/index.ts` must stay import-free of anything outside `base44/functions/family/` (Base44 bundles one top-level function directory together; cross-top-level-directory imports do not resolve at deploy time) — see `guardedEntityWrite/logic.ts`'s header comment for the same rule stated for its own directory.
- Pure decision logic must have zero imports and zero I/O so `deno test base44/functions/` can run it with no network/SDK access (`_agentGuard.test.ts`, `guardedEntityWrite/logic.test.ts` are the existing examples).
- `User.data.family_id` is already write-locked (`base44/entities/User.jsonc`, deployed) to `{user_condition: {role: admin}}` — every write to it must go through `base44.asServiceRole`, never a plain client write.
- Match this repo's existing card styling in `AccountSettings.jsx`: `bg-card border border-border rounded-2xl p-4 shadow-sm` for a section, `text-sm font-semibold text-foreground` for a heading, `text-xs text-muted-foreground` for body copy.
- User-facing strings in Spanish; code comments and identifiers in English (repo convention).
- No frontend test runner exists in this repo — frontend tasks are verified via `npm run lint`, `npm run build`, `npm run validate:rls`, not automated tests.
- This is a Base44 app: merging to `main` deploys nothing. Shipping requires `npm run deploy` (functions) and `npm run deploy:site` (frontend) — out of scope for this plan's tasks, called out in the final task.

---

## File Structure

| File | Responsibility |
|---|---|
| `base44/functions/family/handlers/switchFamilyLogic.ts` | **Create.** Pure decision: given the caller's actual approved memberships and a requested `family_id`, allow or deny. No imports, no I/O. |
| `base44/functions/family/handlers/switchFamilyLogic.test.ts` | **Create.** Deno unit tests for the above. |
| `base44/functions/family/handlers/switchFamily.ts` | **Create.** The `family` action handler: auth, re-fetch memberships via `asServiceRole`, call the logic above, write `User.data.family_id` + bump `last_active_at` on success. |
| `base44/functions/family/handlers/index.ts` | **Modify.** Register `switchFamily` in the `HANDLERS` map. |
| `base44/entities/User.jsonc` | **Modify.** Add `switchFamily` to the `family_id` field description's list of legitimate writers (doc-only, no `rls` change). |
| `src/lib/FamilyContext.jsx` | **Modify.** Step 1's query fetches all approved memberships (not just the first), resolves the active one against `currentUser.data.family_id`, and exposes `familyCandidates` on context. |
| `src/components/family/FamilySwitcher.jsx` | **Create.** The shared switcher UI — compact and full-screen variants via a `fullScreen` prop. |
| `src/pages/AccountSettings.jsx` | **Modify.** Render `<FamilySwitcher />` in a new section. |
| `src/App.jsx` | **Modify.** `FamilyGate` renders `<FamilySwitcher fullScreen />` instead of `<Onboarding />` when resolution is ambiguous. |
| `CLAUDE.md` | **Modify.** Document the feature, per this repo's convention of recording every change with root cause / rationale. |

---

### Task 1: `switchFamily` decision logic (TDD)

**Files:**
- Create: `base44/functions/family/handlers/switchFamilyLogic.ts`
- Test: `base44/functions/family/handlers/switchFamilyLogic.test.ts`

**Interfaces:**
- Produces: `decideSwitchFamily(memberships: {family_id: string, status: string}[], requestedFamilyId: string): {allowed: boolean, reason?: string}` — consumed by Task 2's `switchFamily.ts`.

- [ ] **Step 1: Write the failing tests**

Create `base44/functions/family/handlers/switchFamilyLogic.test.ts`:

```ts
// Unit tests for switchFamily's pure decision logic. Runs under
// `deno test base44/functions/` with no platform/DB access — same style as
// guardedEntityWrite/logic.test.ts and _agentGuard.test.ts.

import { decideSwitchFamily } from "./switchFamilyLogic.ts";

function assertEquals(actual: unknown, expected: unknown, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`assertEquals failed (${msg}): ${a} !== ${e}`);
}

Deno.test("decideSwitchFamily: allows switching to a family the caller has an approved membership in", () => {
  const memberships = [
    { family_id: "fam_a", status: "approved" },
    { family_id: "fam_b", status: "approved" },
  ];
  assertEquals(decideSwitchFamily(memberships, "fam_b"), { allowed: true });
});

Deno.test("decideSwitchFamily: denies a family_id not among the caller's memberships at all", () => {
  const memberships = [{ family_id: "fam_a", status: "approved" }];
  assertEquals(decideSwitchFamily(memberships, "fam_other"), { allowed: false, reason: "not_a_member" });
});

Deno.test("decideSwitchFamily: denies a pending (not yet approved) membership identically to no membership", () => {
  const memberships = [{ family_id: "fam_a", status: "pending" }];
  assertEquals(decideSwitchFamily(memberships, "fam_a"), { allowed: false, reason: "not_a_member" });
  assertEquals(decideSwitchFamily([], "fam_a"), { allowed: false, reason: "not_a_member" });
});

Deno.test("decideSwitchFamily: denies a missing, empty, or non-string family_id", () => {
  const memberships = [{ family_id: "fam_a", status: "approved" }];
  assertEquals(decideSwitchFamily(memberships, ""), { allowed: false, reason: "invalid_family_id" });
  // deno-lint-ignore no-explicit-any
  assertEquals(decideSwitchFamily(memberships, null as any), { allowed: false, reason: "invalid_family_id" });
});

Deno.test("decideSwitchFamily: a rejected membership does not grant access", () => {
  const memberships = [{ family_id: "fam_a", status: "rejected" }];
  assertEquals(decideSwitchFamily(memberships, "fam_a"), { allowed: false, reason: "not_a_member" });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from the repo root — download deno first if `which deno` reports nothing, per `CLAUDE.md`'s documented method):

```bash
which deno || (curl -sSL -o /tmp/deno.zip https://github.com/denoland/deno/releases/download/v2.9.5/deno-x86_64-unknown-linux-gnu.zip && unzip -q -o /tmp/deno.zip -d /tmp && chmod +x /tmp/deno)
DENO=$(which deno || echo /tmp/deno)
$DENO test base44/functions/family/handlers/switchFamilyLogic.test.ts
```

Expected: FAIL — `switchFamilyLogic.ts` does not exist yet (`Module not found`).

- [ ] **Step 3: Write the minimal implementation**

Create `base44/functions/family/handlers/switchFamilyLogic.ts`:

```ts
// Pure decision logic for switchFamily — no imports, no I/O, so it can be
// unit-tested directly (see switchFamilyLogic.test.ts) without starting a
// server. Same split, and same reason, as guardedEntityWrite/logic.ts:
// entry-point code (switchFamily.ts) that does real I/O imports this file —
// an intra-function-directory import is fine, Base44 bundles a whole
// function directory together; it's only imports ACROSS separate top-level
// function directories that don't work.

export interface MembershipRow {
  family_id: string;
  status: string;
}

export interface SwitchDecision {
  allowed: boolean;
  reason?: "invalid_family_id" | "not_a_member";
}

// Decides whether `requestedFamilyId` is a family the caller may switch to,
// given their actual approved memberships (fetched server-side via
// asServiceRole by the caller of this function — never trust a client-sent
// membership list). Denies identically whether the id belongs to someone
// else's family or doesn't exist at all — no existence oracle
// (acacia-app-standard STANDARD.md §18, point 2).
export function decideSwitchFamily(
  memberships: MembershipRow[],
  requestedFamilyId: string,
): SwitchDecision {
  if (!requestedFamilyId || typeof requestedFamilyId !== "string") {
    return { allowed: false, reason: "invalid_family_id" };
  }
  const isApprovedMember = memberships.some(
    (m) => m.status === "approved" && m.family_id === requestedFamilyId,
  );
  if (!isApprovedMember) {
    return { allowed: false, reason: "not_a_member" };
  }
  return { allowed: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
DENO=$(which deno || echo /tmp/deno)
$DENO test base44/functions/family/handlers/switchFamilyLogic.test.ts
```

Expected: PASS — 5 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add base44/functions/family/handlers/switchFamilyLogic.ts base44/functions/family/handlers/switchFamilyLogic.test.ts
git commit -m "Add switchFamily decision logic with tests"
```

---

### Task 2: `switchFamily` handler + registration

**Files:**
- Create: `base44/functions/family/handlers/switchFamily.ts`
- Modify: `base44/functions/family/handlers/index.ts`

**Interfaces:**
- Consumes: `decideSwitchFamily` from Task 1 (`./switchFamilyLogic.ts`).
- Produces: the `switchFamily` action on the `family` function — request body `{family_id: string}`, success response `{success: true}`, failure `{error: string}` with status 401/403/500.

- [ ] **Step 1: Write the handler**

Create `base44/functions/family/handlers/switchFamily.ts`:

```ts
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { decideSwitchFamily } from './switchFamilyLogic.ts';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { family_id } = await req.json();

    // Re-derive the caller's memberships from scratch — never trust a
    // client-sent candidate list (acacia-app-standard STANDARD.md §18,
    // point 2). Same user_id -> user_email fallback used by every other
    // handler in this directory (e.g. getMyMembership.ts).
    let memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_id: user.id });
    if (!memberships.length) {
      memberships = await base44.asServiceRole.entities.FamilyMembership.filter({ user_email: user.email });
    }

    const decision = decideSwitchFamily(memberships, family_id);
    if (!decision.allowed) {
      return Response.json({ error: 'No perteneces a esa familia' }, { status: 403 });
    }

    // User.data.family_id is write-locked to admin/server-only
    // (base44/entities/User.jsonc) — this asServiceRole write is one of its
    // sanctioned writers, alongside selfJoin/approveMember/createFamily/
    // removeMember/setUserFamilyId/fixUserFamilyId. Mirrors the
    // spread-then-delete-nested-data pattern selfJoin.ts and removeMember.ts
    // already use, guarding against the historical data.data double-nesting
    // some User rows carry.
    const userData = { ...(user.data || {}), family_id };
    delete userData.data;
    await base44.asServiceRole.entities.User.update(user.id, { data: userData });

    // Keep last_active_at current on the newly active membership so
    // guardedEntityWrite's resolveFamilyAccess (which falls back to the
    // most-recently-active membership when nothing persisted matches)
    // agrees with this switch going forward.
    const target = memberships.find((m) => m.family_id === family_id);
    if (target) {
      await base44.asServiceRole.entities.FamilyMembership.update(target.id, {
        last_active_at: new Date().toISOString(),
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Register the action**

In `base44/functions/family/handlers/index.ts`, add the import and map entry:

```ts
import { handle as approveMember } from './approveMember.ts';
import { handle as createFamily } from './createFamily.ts';
import { handle as findFamilyByCode } from './findFamilyByCode.ts';
import { handle as getFamilyBillingStatus } from './getFamilyBillingStatus.ts';
import { handle as getFamilyLicenseInfo } from './getFamilyLicenseInfo.ts';
import { handle as getMyFamily } from './getMyFamily.ts';
import { handle as getMyMembership } from './getMyMembership.ts';
import { handle as linkPersonToMember } from './linkPersonToMember.ts';
import { handle as removeMember } from './removeMember.ts';
import { handle as selfJoin } from './selfJoin.ts';
import { handle as switchFamily } from './switchFamily.ts';
import { handle as verifyFamilyAccess } from './verifyFamilyAccess.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  approveMember,
  createFamily,
  findFamilyByCode,
  getFamilyBillingStatus,
  getFamilyLicenseInfo,
  getMyFamily,
  getMyMembership,
  linkPersonToMember,
  removeMember,
  selfJoin,
  switchFamily,
  verifyFamilyAccess,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
```

- [ ] **Step 3: Verify with deno lint and the full deno test suite**

```bash
DENO=$(which deno || echo /tmp/deno)
$DENO lint base44/functions/family/handlers/switchFamily.ts base44/functions/family/handlers/index.ts
$DENO test base44/functions/
```

Expected: lint reports no issues; the full test suite passes (includes Task 1's new tests plus every pre-existing `*.test.ts` under `base44/functions/`).

- [ ] **Step 4: Commit**

```bash
git add base44/functions/family/handlers/switchFamily.ts base44/functions/family/handlers/index.ts
git commit -m "Add switchFamily handler and register it on the family function"
```

---

### Task 3: `FamilyContext.jsx` resolver — expose the full candidate list

**Files:**
- Modify: `src/lib/FamilyContext.jsx:54-75` (Step 1's `useQuery`) and its consumers in the same file (`familyId`, provider value object).

**Interfaces:**
- Produces: `useFamily().familyCandidates` — array of the caller's approved `FamilyMembership` rows (each with at least `family_id`, `role`). `useFamily().membership` keeps its existing meaning (the resolved *active* membership, or `null`/`undefined`) — no shape change for any existing consumer.

- [ ] **Step 1: Replace the membership query**

In `src/lib/FamilyContext.jsx`, replace:

```js
  // ── Step 1: Load membership directly from entity SDK (no backend function) ──
  const { data: membership, isError: membershipError, refetch: refetchMembership } = useQuery({
    queryKey: ['my-membership', currentUser?.id],
    queryFn: async () => {
      // Try by user_id first
      let results = await base44.entities.FamilyMembership.filter({ user_id: currentUser.id, status: 'approved' });
      if (!results.length) {
        // Fallback to email
        results = await base44.entities.FamilyMembership.filter({ user_email: currentUser.email, status: 'approved' });
      }
      return results[0] || null;
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,  // 5 min — don't re-fetch on every navigation
    gcTime: 10 * 60 * 1000,
    retry: (failCount, error) => {
      // Don't retry on 429 — wait for rate limit to clear
      if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) return false;
      return failCount < 2;
    },
    retryDelay: (attempt) => Math.min(2000 * 3 ** attempt, 15000),
  });
```

with:

```js
  // ── Step 1: Load membership directly from entity SDK (no backend function) ──
  // Fetches EVERY approved membership, not just the first — a user approved
  // on 2+ families gets a real switcher instead of being silently pinned to
  // whichever row the API returns first. See
  // docs/MULTI_FAMILY_SWITCHER_DESIGN.md and acacia-app-standard's
  // STANDARD.md §18 ("Multi-tenant account switching").
  const { data: membershipResolution, isError: membershipError, refetch: refetchMembership } = useQuery({
    queryKey: ['my-membership', currentUser?.id],
    queryFn: async () => {
      // Try by user_id first
      let approved = await base44.entities.FamilyMembership.filter({ user_id: currentUser.id, status: 'approved' });
      if (!approved.length) {
        // Fallback to email
        approved = await base44.entities.FamilyMembership.filter({ user_email: currentUser.email, status: 'approved' });
      }

      if (approved.length <= 1) {
        return { active: approved[0] || null, candidates: approved };
      }

      // 2+ approved memberships: prefer whichever matches the persisted
      // active family_id (mirrors guardedEntityWrite's resolveFamilyAccess,
      // so reads and writes agree on which family is "current"). If nothing
      // persisted matches, leave `active` null rather than guessing —
      // FamilyGate shows the switcher in that case instead of silently
      // picking one.
      const activeFamilyId = currentUser?.data?.family_id || null;
      const active = approved.find(m => m.family_id === activeFamilyId) || null;
      return { active, candidates: approved };
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,  // 5 min — don't re-fetch on every navigation
    gcTime: 10 * 60 * 1000,
    retry: (failCount, error) => {
      // Don't retry on 429 — wait for rate limit to clear
      if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) return false;
      return failCount < 2;
    },
    retryDelay: (attempt) => Math.min(2000 * 3 ** attempt, 15000),
  });

  // Preserve the exact isLoading semantics every consumer already relies on
  // (membership === undefined while the query is pending) while unwrapping
  // the {active, candidates} shape above.
  const membership = membershipResolution === undefined ? undefined : membershipResolution.active;
  const familyCandidates = membershipResolution?.candidates || [];
```

- [ ] **Step 2: Expose `familyCandidates` on the context value**

Find the `FamilyContext.Provider value={{ ... }}` block near the end of the file and add `familyCandidates,` to it (alongside the existing `membership,` line):

```js
    <FamilyContext.Provider value={{
      currentUser,
      family,
      familyId,
      familyConfigId,
      membership,
      familyCandidates,
      isAdmin,
```

Also add `familyCandidates: [],` to the default context object near the top of the file (the `createContext({...})` call), alongside the existing `membership: null,` line, so a component reading `useFamily()` outside a `<FamilyProvider>` doesn't crash on `.length`.

- [ ] **Step 3: Verify**

```bash
npm run lint
npm run build
```

Expected: both pass — `familyId`, `isAdmin`, `defaultPersonId` and every other value derived from `membership` further down in the file are unchanged in shape, so no other line in `FamilyContext.jsx` needs editing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/FamilyContext.jsx
git commit -m "FamilyContext: resolve the full candidate list, not just the first membership"
```

---

### Task 4: `FamilySwitcher` component

**Files:**
- Create: `src/components/family/FamilySwitcher.jsx`

**Interfaces:**
- Consumes: `useFamily()` → `familyCandidates`, `membership`, `refetchMembership` (Task 3). `base44.functions.invoke('family', {action: 'getMyFamily', family_id})` (existing endpoint — already authorizes a caller against an approved-but-inactive membership, not just their current active family). `base44.functions.invoke('family', {action: 'switchFamily', family_id})` (Task 2).
- Produces: `<FamilySwitcher fullScreen?: boolean />` — renders `null` when `familyCandidates.length <= 1`.

- [ ] **Step 1: Write the component**

Create `src/components/family/FamilySwitcher.jsx`:

```jsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { Home, Loader2, Check } from 'lucide-react';

// Renders in two places (acacia-app-standard STANDARD.md §18: "one switcher,
// reachable once it's needed" — same component, two entry points):
//   - compact, embedded in AccountSettings.jsx, for a user who wants to
//     switch families at any time;
//   - fullScreen, from App.jsx's FamilyGate, when a login resolves to 2+
//     approved memberships with none persisted as active yet.
// Renders nothing when there's nothing to choose between — a single-family
// user (the overwhelming majority) never sees this component render any UI.
export default function FamilySwitcher({ fullScreen = false }) {
  const { familyCandidates, membership } = useFamily();

  // getMyFamily already authorizes a caller against ANY of their approved
  // memberships, not just the currently-active one (see
  // family/handlers/getMyFamily.ts) — Family's own RLS would otherwise block
  // a direct client read of a family that isn't the caller's current active
  // one, which is exactly why this goes through the function instead of
  // base44.entities.Family.filter() directly.
  const { data: namedCandidates, isLoading } = useQuery({
    queryKey: ['family-switcher-names', familyCandidates.map(c => c.family_id).sort().join(',')],
    queryFn: async () => {
      const results = await Promise.all(familyCandidates.map(async (c) => {
        const res = await base44.functions.invoke('family', { action: 'getMyFamily', family_id: c.family_id });
        return {
          family_id: c.family_id,
          role: c.role,
          name: res.data?.family?.name || c.family_id,
        };
      }));
      return results;
    },
    enabled: familyCandidates.length > 1,
    staleTime: 5 * 60 * 1000,
  });

  const switchMutation = useMutation({
    mutationFn: (family_id) => base44.functions.invoke('family', { action: 'switchFamily', family_id }),
    onSuccess: () => {
      // Hard reload rather than an in-place cache reset — the one reset
      // that cannot leave a stale family_id behind in some closure
      // (acacia-app-standard STANDARD.md §18, point 3).
      globalThis.location.reload();
    },
  });

  if (familyCandidates.length <= 1) return null;

  const activeFamilyId = membership?.family_id || null;
  const wrapperClass = fullScreen
    ? 'min-h-screen bg-background flex items-center justify-center p-6'
    : '';
  const cardClass = fullScreen
    ? 'w-full max-w-sm bg-card border border-border rounded-2xl p-4 shadow-sm'
    : 'bg-card border border-border rounded-2xl p-4 shadow-sm';

  return (
    <div className={wrapperClass}>
      <div className={cardClass}>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {fullScreen ? 'Elige tu familia' : 'Mis familias'}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {fullScreen
            ? 'Perteneces a más de una familia en FlowFin. Elige con cuál quieres entrar.'
            : 'Cambia entre las familias a las que perteneces.'}
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {(namedCandidates || []).map((c) => {
              const isActive = c.family_id === activeFamilyId;
              return (
                <button
                  key={c.family_id}
                  onClick={() => !isActive && switchMutation.mutate(c.family_id)}
                  disabled={isActive || switchMutation.isPending}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                    isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  } disabled:opacity-70`}
                >
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Home className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.role === 'admin' ? 'Administrador' : 'Integrante'}</p>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {switchMutation.isError && (
          <p className="text-xs text-destructive mt-3">No se pudo cambiar de familia. Intenta de nuevo.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npm run lint
npm run build
```

Expected: both pass. The component isn't wired into any page yet, so this only checks it compiles cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/components/family/FamilySwitcher.jsx
git commit -m "Add FamilySwitcher component"
```

---

### Task 5: Wire the switcher into `AccountSettings.jsx`

**Files:**
- Modify: `src/pages/AccountSettings.jsx`

**Interfaces:**
- Consumes: `FamilySwitcher` (Task 4, default export).

- [ ] **Step 1: Import the component**

At the top of `src/pages/AccountSettings.jsx`, add alongside the other imports:

```jsx
import FamilySwitcher from '@/components/family/FamilySwitcher';
```

- [ ] **Step 2: Render it**

Insert a new section right after the "Account Info Card" block (after the closing `</div>` that follows `Información de cuenta`, before the "License Info Card" comment):

```jsx
        {/* Account Info Card */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Información de cuenta</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="text-foreground font-medium">{email || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado</span>
              <span className="text-foreground font-medium">Activo</span>
            </div>
          </div>
        </div>

        {/* Family switcher — renders nothing unless the caller belongs to 2+ families */}
        <FamilySwitcher />

        {/* License Info Card */}
```

- [ ] **Step 3: Verify**

```bash
npm run lint
npm run build
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AccountSettings.jsx
git commit -m "Show FamilySwitcher in AccountSettings"
```

---

### Task 6: Ambiguous-login entry point in `App.jsx`

**Files:**
- Modify: `src/App.jsx:67-125` (`FamilyGate`) and its lazy-import block near the top of the file.

**Interfaces:**
- Consumes: `FamilySwitcher` (Task 4, default export), `useFamily().familyCandidates` (Task 3).

- [ ] **Step 1: Lazy-load the component**

Near the top of `src/App.jsx`, alongside the other `lazy(() => import(...))` page imports:

```jsx
const FamilySwitcher = lazy(() => import('@/components/family/FamilySwitcher'));
```

- [ ] **Step 2: Branch in `FamilyGate`**

Replace:

```jsx
  // Only show Onboarding if we got a confirmed null result (no error) — user genuinely has no family
  if (!membership || !family) return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-16 h-16 rounded-3xl overflow-hidden shadow-lg animate-pulse-ring">
          <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/5dd910449_97d3fb29c_logo.png" alt="FlowFin" className="w-full h-full object-cover" />
        </div>
      </div>
    }>
      <Onboarding />
    </Suspense>
  );
  return children;
};
```

with:

```jsx
  // Only show Onboarding if we got a confirmed null result (no error) — user genuinely has no family
  if (!membership || !family) {
    const loadingFallback = (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-16 h-16 rounded-3xl overflow-hidden shadow-lg animate-pulse-ring">
          <img src="https://media.base44.com/images/public/69b97ea9c9a713486b5a01fd/5dd910449_97d3fb29c_logo.png" alt="FlowFin" className="w-full h-full object-cover" />
        </div>
      </div>
    );

    // Ambiguous resolution — 2+ approved memberships, none persisted as
    // active yet: offer the switcher instead of "crea tu familia o únete a
    // una existente," which would be actively wrong for someone who already
    // belongs to (at least) one. See docs/MULTI_FAMILY_SWITCHER_DESIGN.md.
    if (!membership && familyCandidates.length > 1) {
      return (
        <Suspense fallback={loadingFallback}>
          <FamilySwitcher fullScreen />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={loadingFallback}>
        <Onboarding />
      </Suspense>
    );
  }
  return children;
};
```

- [ ] **Step 3: Read `familyCandidates` from context**

In `FamilyGate`'s destructuring line, add `familyCandidates`:

```jsx
const { isLoading, membership, family, membershipError, refetchMembership, familyCandidates } = useFamily();
```

- [ ] **Step 4: Verify**

```bash
npm run lint
npm run build
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "FamilyGate: show FamilySwitcher instead of Onboarding when ambiguous"
```

---

### Task 7: Docs + full verification pass

**Files:**
- Modify: `base44/entities/User.jsonc`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `User.jsonc`'s `family_id` field description**

In `base44/entities/User.jsonc`, find the `family_id` property's `description` string:

```
"description": "ID de la familia (tenant) a la que pertenece el usuario. Sólo se escribe desde funciones de servidor vía asServiceRole (selfJoin, approveMember, createFamily, removeMember, setUserFamilyId, fixUserFamilyId/fixUserData) — esas escrituras evaden RLS por diseño. El candado de abajo existe para que un cliente no pueda ponerse a sí mismo en la familia de otro (auditoría de aislamiento multi-tenant, módulo 14, 2026-08-23: este campo nunca se declaró aquí, así que no tenía dónde colgar un rls.write, a diferencia de stockflow/puntos/ctrlhq que sí declaran su equivalente business_id).",
```

and change it to add `switchFamily` to the writer list:

```
"description": "ID de la familia (tenant) a la que pertenece el usuario. Sólo se escribe desde funciones de servidor vía asServiceRole (selfJoin, approveMember, createFamily, removeMember, setUserFamilyId, fixUserFamilyId/fixUserData, switchFamily) — esas escrituras evaden RLS por diseño. El candado de abajo existe para que un cliente no pueda ponerse a sí mismo en la familia de otro (auditoría de aislamiento multi-tenant, módulo 14, 2026-08-23: este campo nunca se declaró aquí, así que no tenía dónde colgar un rls.write, a diferencia de stockflow/puntos/ctrlhq que sí declaran su equivalente business_id).",
```

This is a description-only change — `rls` is untouched, so it doesn't require `npm run deploy:entities` to take effect functionally; the description text itself only reaches Base44 on the next entities deploy, whenever that next legitimately happens.

- [ ] **Step 2: Add a CLAUDE.md entry**

Append to the end of `CLAUDE.md` (matching this repo's existing convention — see e.g. the "Onboarding volvía a..." or "Módulo 15" sections above it):

```markdown
## Multi-family account switcher (module 18, 2026-08-25)

Closes the `acacia-app-standard` STANDARD.md §18 gap: FlowFin already allows
one email to hold approved `FamilyMembership` rows in more than one
`Family`, but nothing surfaced that to the user or let them choose — the
resolver (`FamilyContext.jsx`) took `results[0]` of the caller's approved
memberships and never even looked at `User.data.family_id`, the persisted
"active family" pointer every *write* path already respects
(`guardedEntityWrite`'s `resolveFamilyAccess`). A user with 2+ approved
memberships could have reads display one family while writes landed in
another, silently, with no error and no way out short of a support ticket —
found while grounding this feature's design, not separately reported.

**Fix, in three pieces:**

1. `FamilyContext.jsx`'s membership query now fetches *every* approved
   membership. If `User.data.family_id` matches one, that's active (no
   behavior change for the single-family case — the overwhelming majority).
   If nothing persisted matches and there's exactly one candidate, that one
   auto-activates. If nothing persisted matches and there are 2+ candidates,
   the query resolves `active: null` instead of guessing — the new
   `familyCandidates` array on context is what the switcher reads.
2. New `family` action `switchFamily`
   (`base44/functions/family/handlers/switchFamily.ts` +
   `switchFamilyLogic.ts`, the latter pure and deno-tested, same split as
   `guardedEntityWrite/logic.ts`): re-derives the caller's approved
   memberships from scratch server-side (never trusts the client), denies a
   `family_id` outside that set identically whether it belongs to someone
   else or doesn't exist, and on success writes `User.data.family_id` via
   `asServiceRole` — the field's already-locked, already-deployed write
   path (module 14 finding #1's fix, `ec2b435`, 2026-08-24) — plus bumps
   `last_active_at` on the newly-active membership so `resolveFamilyAccess`
   agrees going forward.
3. `src/components/family/FamilySwitcher.jsx`: one component, two entry
   points, both gated on `familyCandidates.length > 1` so a single-family
   user never sees it render anything. Compact, inside
   `AccountSettings.jsx`. Full-screen, from `App.jsx`'s `FamilyGate`, when
   resolution is ambiguous — replacing `Onboarding`'s "crea tu familia o
   únete a una existente" (actively wrong copy for someone who already
   belongs to at least one family) with "elige tu familia" for that specific
   case only. Family names for candidates come from the existing
   `getMyFamily` action, which already authorizes a caller against any of
   their approved memberships (not just the current active one) — a direct
   client read of `Family` would be blocked by its own RLS
   (`id === user.data.family_id` OR `admin_user_id === user.id`) for a
   candidate that isn't currently active and wasn't created by that user.

**Verified:** `npm run lint`, `npm run build` (incl. `permissions-check.mjs`),
`npm run validate:rls` (36 entities), `deno lint base44/functions/`, `deno
test base44/functions/` all green. **Not verified:** an actual dual-membership
login exercising the switcher end-to-end — this sandbox has no seeded
account approved on two families, same limitation this repo's module 14
audit already flags for its own unverifiable claims. Deploying requires both
`npm run deploy` (the new `switchFamily` function) and `npm run deploy:site`
(the frontend) — see "Base44 — mergear a `main` no deploya NADA" above.
```

- [ ] **Step 3: Full verification pass**

```bash
npm run lint
npm run build
npm run validate:rls
DENO=$(which deno || echo /tmp/deno)
$DENO lint base44/functions/
$DENO test base44/functions/
```

Expected: every command exits 0 with no new errors.

- [ ] **Step 4: Commit**

```bash
git add base44/entities/User.jsonc CLAUDE.md
git commit -m "Document the multi-family switcher (module 18) in CLAUDE.md"
```

---

## Not in scope for this plan

- Deploying (`npm run deploy` / `npm run deploy:site`) — do this by hand once the PR merges, per `CLAUDE.md`'s standing instruction that merging deploys nothing.
- Seeding a real dual-membership test account to exercise the switcher end-to-end in a live browser session — not achievable from this sandbox.
