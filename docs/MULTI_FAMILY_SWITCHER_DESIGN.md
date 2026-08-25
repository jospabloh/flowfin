# Multi-family account switcher — design (2026-08-25)

Closes the gap the portfolio standard (`jospabloh/acacia-app-standard` →
`STANDARD.md` §18, "Multi-tenant account switching") describes: nothing in
FlowFin's data model stops one email from being an approved member of more
than one `Family`, but nothing in the app lets a user see or choose between
them either.

## Problem

`FamilyContext.jsx`'s membership query:

```js
let results = await base44.entities.FamilyMembership.filter({ user_id: currentUser.id, status: 'approved' });
if (!results.length) results = await base44.entities.FamilyMembership.filter({ user_email: currentUser.email, status: 'approved' });
return results[0] || null;
```

takes `results[0]` — whichever approved membership row comes back first —
and **never consults `User.data.family_id`**, the persisted "active family"
pointer every other write path in this app already respects.
`guardedEntityWrite`'s `resolveFamilyAccess` (the resolver on the *write*
side) does consult it: it prefers the membership matching the persisted
`family_id`, falling back to the most-recently-active one only when nothing
persisted matches. So a user with two approved memberships can already have
reads display one family while writes land in another — silently, with no
error and no way to tell which is which from the UI. This was found while
grounding this design, not reported directly, but it's the same shape of gap
`STANDARD.md` §18 names: a resolver that picks instead of asking, with no way
out short of a support ticket.

`User.data.family_id` itself is already correctly locked
(`base44/entities/User.jsonc`, `rls.write: {user_condition: {role: admin}}`,
confirmed live in the deployed schema via Base44 MCP `list_entity_schemas` —
see commit `ec2b435`, 2026-08-24, module 14 finding #1's fix). This design
does not touch that lock; it adds the one legitimate way a *user* changes
their own pointer.

## Design

### 1. Resolver — `FamilyContext.jsx`

Step 1's query changes from "first approved membership" to "all approved
memberships, then pick":

- fetch every `FamilyMembership` row with `status: 'approved'` for this user
  (by `user_id`, falling back to `user_email` — same two-step lookup as
  today, just not truncated to one result);
- if `currentUser.data.family_id` matches one of them, that's the active
  membership — no behavior change for the common single-family case, and
  read/write now agree for the multi-family case too;
- else if there's exactly one candidate, use it (nothing to choose — matches
  `STANDARD.md` §18's "no reason to interrupt a user who has only ever
  belonged to one tenant");
- else (0 matched-and-persisted, 2+ candidates): resolve to `null` — this is
  the ambiguous state `FamilyGate` (below) turns into the switcher, not
  `Onboarding`.

The full `candidates` array (each with `family_id`, and the family name once
loaded) is exposed on `FamilyContext` for the switcher UI, gated everywhere
on `candidates.length > 1` — a single-family user never sees a switcher with
nothing to switch to.

### 2. `switchFamily` — new `family` action

Split like `guardedEntityWrite`, for the same reason: a pure decision core
that unit-tests without a server.

- **`family/handlers/switchFamily/logic.ts`** (no imports, no I/O): given the
  caller's actual approved memberships (re-fetched server-side, never the
  client's word for it) and a requested `family_id`, decides allow/deny.
  Denies identically whether the id belongs to someone else's family or
  doesn't exist at all — no existence oracle, per `STANDARD.md` §18 point 2.
- **`family/handlers/switchFamily/index.ts`** (the `handle()` export
  `family/handlers/index.ts` registers, same role `guardedEntityWrite/entry.ts`
  plays for its own logic core): authenticates the caller, re-fetches their
  approved `FamilyMembership` rows via `asServiceRole`, calls the logic core,
  and on approval writes `User.data.family_id` via `asServiceRole` (the
  sanctioned path — this becomes the 7th entry in `User.jsonc`'s
  `family_id` field description's list of legitimate writers) and bumps
  `last_active_at` on the newly-active membership row, so the resolver above
  and `resolveFamilyAccess`'s write-side fallback stay in agreement.
- The auto-assign-the-only-candidate case (resolver step 3 above) also
  calls this same endpoint under the hood rather than writing the pointer
  through a second path — one write path, always validated the same way.

### 3. `FamilySwitcher` component — one component, two entry points

`src/components/family/FamilySwitcher.jsx`:

- **Compact**, inside `AccountSettings.jsx` as a new section (visible only
  when `candidates.length > 1`): lists the caller's families by name, marks
  the active one, lets them pick another.
- **Full-screen**, from `App.jsx`'s `FamilyGate`: when resolution is
  ambiguous (`!membership && candidates.length > 1`), render this instead of
  `Onboarding` — a brand-new ambiguous login sees "elige tu familia," not
  "crea tu familia o únete a una."

Both entry points share the same list-and-switch core; the wrapping
layout/chrome differs (embedded section vs. centered full-screen), matching
how `Onboarding`'s own screens are structured today.

Picking a different family calls `switchFamily`, then
`window.location.reload()` on success — no in-place cache/hook reset. This
matches `STANDARD.md` §18's own reasoning: an in-place reset is exactly
where a stale `family_id` survives in some closure, and a reload is the one
reset that can't leave one behind.

## What this does not change

- `User.data.family_id`'s RLS lock — already done, already deployed.
- `resolveFamilyAccess` / `guardedEntityWrite` — unchanged; this design makes
  the *read* side agree with what that resolver already does, it doesn't
  touch the write-side resolver itself.
- Every family's own RLS and permission model — a caller is always acting as
  exactly one family at a time; switching only changes which one, through
  the same server-authoritative field write every other legitimate writer
  already uses.

## Testing

- `switchFamily/logic.ts` + `logic.test.ts` — deno test, same convention as
  `guardedEntityWrite/logic.ts` + `logic.test.ts`.
- No frontend test runner in this repo (documented constraint, see
  `CLAUDE.md`) — `FamilyContext.jsx` and `FamilySwitcher.jsx` changes are
  verified via `npm run lint` / `npm run build` / `npm run validate:rls`,
  same as every other frontend change in this repo.
- Manual verification path (per `STANDARD.md` §18's own verification gate):
  log in as an email approved on two families and confirm (a) the switcher
  lists both by name, (b) switching changes every family-scoped screen's
  data, not just a header, (c) requesting a `family_id` the caller doesn't
  belong to gets the same rejection as a nonexistent one. Not achievable
  from this sandbox (no seeded dual-membership test account) — flag as
  not-verified in the implementation writeup, same as this repo's module 14
  audit already does for its own unverifiable claims.

## Deploy

Touches `base44/entities/User.jsonc` (description-only addition — no RLS
change), a new `base44/functions/family/handlers/switchFamily*`, and
`src/`. Per `CLAUDE.md`: merging alone deploys nothing. Shipping requires
`npm run deploy` (functions) and `npm run deploy:site` (frontend); the
entity description change needs no `deploy:entities` since it doesn't alter
`rls`.
