# FlowFin Security and Code Quality Audit Report
**Date**: August 3, 2026 (Updated — v2.20.4 Audit)
**Version Audited**: 2.20.4
**Auditor**: Claude Code Automated Security Review
**Overall Risk Level**: **LOW** — periodic review found no new critical or
high application-level finding since v2.20.3. One dependency advisory
(`brace-expansion`, high, dev-toolchain-only) was patched this cycle; the
other (`react-router`, moderate) remains deferred pending a major-version
migration, unchanged. CSP deployed; CI gate active (`validate:rls`, and as
of this cycle also `lint` + `permissions:check`); RLS enforced across all
36 entities; permission deny-by-default enforced.

**Open operational item carried over from v2.20.3 (not verifiable from this
repository alone)**: the CRITICAL analytics/family cross-family-exposure fix
merged in v2.20.3 lives under `base44/functions/`, which does not
auto-deploy on merge to `main` (see `CLAUDE.md`). This audit cycle could not
confirm from GitHub whether `base44 functions deploy --app-id
69b97ea9c9a713486b5a01fd --force` has actually been run since 2026-07-27.
**If it has not, that CRITICAL vulnerability is still live in production
despite being fixed in code.** Verifying and, if needed, running that
deploy is the single highest-priority owner action arising from this audit.

---

## v2.20.4 Audit Cycle (2026-08-03)

Scope: security, RLS, granular permissions, dependencies, CI/CD health.
Reviewed all commits landed since the v2.20.3 audit (2026-07-27) — one
substantive commit (the v2.20.3 fix itself) plus routine `base44-builder[bot]`
package-sync commits; no other application code changed in the interim.

- **Security**: no hardcoded secrets found (searched for common key/token
  patterns across the repo). No new unauthenticated or cross-family data
  paths identified. `SECURITY.md`'s existing disclosure process unchanged.
- **RLS**: re-verified `validate:rls` (36/36 entities OK) and manually
  spot-checked `Transaction`, `Category`, `Person`, and `FamilyMembership`
  — all retain the family-member `read` branch (`data.family_id ==
  {{user.data.family_id}}` or equivalent) alongside the admin branch. The
  2026-06-29 admin-only-read regression pattern documented in `CLAUDE.md`
  has **not** recurred.
- **Permissions**: `permissions:check` passes — 215 declared keys, 89 used,
  **0 missing** (every key referenced in code is declared). 76 declared
  keys are unused ("orphans") — these are pre-existing reserved keys for
  modules not yet exposed in the UI (e.g. `investment.*`, `rental.*`
  detail/edit actions); not a regression, and orphans fail-open safely
  (undeclared code paths are what `permissions:check` blocks, not unused
  declarations). No action taken — flagged for awareness only, since
  removing declared-but-reserved keys is a product decision, not a
  security fix.
- **Dependencies**: `npm audit` showed 3 issues (1 high, 2 moderate).
  `brace-expansion` (high) fixed via `npm audit fix` (non-breaking). The two
  `react-router`/`react-router-dom` advisories (moderate) remain deferred —
  same documented rationale as v2.20.3 (SPA, no SSR; fix requires a 6→7
  major migration warranting its own dedicated, regression-tested PR).
  `npm audit --audit-level=critical`: 0 critical, CI gate unaffected.
- **CI/CD**: `ci.yml`'s `npm-audit` job ran `npm ci`, `validate:rls`, and
  `npm audit --audit-level=critical` but **not** `lint` or
  `permissions:check` — a lint or permission-key regression on `main`
  between releases would not have failed CI. Added both as CI steps this
  cycle (see CHANGELOG). No test suite exists in this project
  (`package.json` has no `test` script); `npm run build` was run locally
  as part of this audit and passed.
- **Stale artifacts**: two branches left over from prior audit cycles,
  `claude/flowfin-audit-release-6akkr8` and
  `claude/flowfin-audit-security-7dki8p`, were confirmed fully merged into
  `main` (via PRs #170/#171 and #159/#160 respectively) with no unique
  unmerged work, and deleted.
- **Verified locally before opening the PR**: `npm run lint` ✅,
  `npm run validate:rls` ✅ (36 entities), `npm run permissions:check` ✅
  (0 missing), `npm run build` ✅, `npm audit --audit-level=critical` ✅
  (0 critical).

## Executive Summary

This report reflects the cumulative audit status through **v2.20.3**.
**v2.20.3** (this release) closes a **CRITICAL** unauthenticated cross-family
data exposure in 7 `analytics` router handlers (client-supplied `family_id`
trusted with no session), a **MEDIUM** authorization gap in
`family/findFamilyByCode` (client-supplied `user_id` instead of the
authenticated caller), and applies 3 non-breaking dependency security patches
(dompurify, js-yaml, postcss). The v0.7.0 release closed 15 dependency
vulnerabilities. **v2.18.0** hardened AI-response validation and
PublicSnapshot RLS. **v2.19.0** closed a HIGH-severity permission gap in the
Support Tickets module. **v2.20.0** closed a MEDIUM-severity navigation
permission bypass for the Trips and Goals modules and added RLS hardening
for Trip and SupportTicketMessage entities.

**npm audit**: ⚠️ **2 known issues** (1 high, 1 moderate) — both deferred,
see "Dependency Vulnerabilities" below; 0 critical (CI gate:
`--audit-level=critical`, unaffected).
**validate:rls**: ✅ **36 entities OK** — all Base44 entity schemas pass static RLS checks.
**permissions:check**: ✅ **215 declared keys, 0 missing** — all permission keys valid.
**ESLint**: ✅ **0 errors** — lint clean.
**Build**: ✅ passes (`npm run build`).
**Backend auth audit (this cycle)**: all 91 `asServiceRole`-using handlers
under `base44/functions/**` reviewed for tenant-isolation and auth-bypass
risk; 2 confirmed issues found and fixed (see below), no others found.

**Status**: ⚠️ **CODE FIXED, DEPLOY PENDING** — the critical finding above is
fixed in this PR's diff and verified statically (build/lint/RLS/permissions
checks all pass), but it lives under `base44/functions/`, which this
repository's own deployment model does **not** redeploy on merge to `main`
— it requires a separate, manual `base44 functions deploy --app-id
69b97ea9c9a713486b5a01fd --force` run by someone with Base44 CLI access.
**This is the single highest-priority owner action from this audit.**

---

## What Changed Since v0.1.0

### ✅ Fixed in v2.20.3 (July 27, 2026)

| # | Issue | File(s) | Severity |
|---|-------|---------|----------|
| 1 | 7 `analytics` router handlers trusted a client-supplied `family_id` with no authentication check when no session was present, allowing any unauthenticated caller to read another family's transaction breakdowns/totals via the service-role client (bypasses RLS) | `base44/functions/analytics/handlers/{getBreakdownByPaymentMethod,getBreakdownByPerson,getCategoryStats,getPeriodComparison,getPeriodTotals,getTimeSeries,getTopTransactions}.ts` | **CRITICAL** |
| 2 | `family/findFamilyByCode` used a client-supplied `user_id` (instead of the authenticated caller's own id) to check membership, letting an authenticated user probe an arbitrary user_id's membership status for a family they know the join code for | `base44/functions/family/handlers/findFamilyByCode.ts` | MEDIUM |
| 3 | 3 dependency vulnerabilities patched (non-breaking): `dompurify` (custom-element sanitization bypass), `js-yaml` (quadratic CPU via merge-key chains), `postcss` (source-map path traversal) | `package.json`, `package-lock.json` | LOW/HIGH* (*build-tooling exposure, not shipped to end users) |

**Deferred (not fixed this release, documented rationale):**
- `brace-expansion` (HIGH, ReDoS) — reachable only via the `eslint`/`eslint-plugin-react` dev toolchain, not bundled to users. Fix requires an `eslint` 9→10 major bump; deferred to a dedicated, manually-tested dependency-upgrade PR.
- `react-router`/`react-router-dom` (MODERATE — open redirect via backslash in `<Link>`/`useNavigate`; SSR-hydration constructor injection does not apply, FlowFin is a client-rendered SPA) — fix requires a 6→7 major-version migration; deferred to a dedicated PR with route-by-route regression testing.
- Neither reaches `critical` severity, matching this project's existing accepted-risk convention (see the `xlsx` entry below).

### ✅ Fixed in v2.20.0 (July 6, 2026)

| # | Issue | File(s) | Severity |
|---|-------|---------|----------|
| 1 | `module.Trips` and `module.Goals` nav visibility hardcoded to `true` in `Layout.jsx` — admin revocations had no effect on sidebar visibility | `src/components/Layout.jsx` (added `useCanView('module.Trips')` and `useCanView('module.Goals')`) | MEDIUM |
| 2 | `Trip` and `SupportTicketMessage` RLS did not scope by declared owner field — cross-family data access possible at DB layer | `base44/entities/Trip.jsonc`, `base44/entities/SupportTicketMessage.jsonc` (PRs #159/160) | HIGH |

**AppSession security review (new entity, v2.20.0):**
- RLS: end-users only touch their own rows (scoped by `created_by_id`); service role (admin) has full access for Mission Control list/revoke operations. ✅ SAFE
- `user_email` / `user_name` are written client-side (display-only fields — Mission Control authenticates via the Base44 token, not these values). ✅ INFO — no authentication bypass risk.
- `device` label derived from `navigator.userAgent` — display-only, cannot elevate privilege. ✅ SAFE
- Heartbeat is best-effort (errors swallowed) — session tracking never blocks app functionality. ✅ SAFE

**Mission Control push notification (INFO):**
- `SupportTickets.jsx` sends a fire-and-forget POST to `https://control.acaciaco.com.mx/api/ingest/ticket-pull` with only the ticket ID (no PII, no auth token). Mission Control authenticates the follow-up read via the separate `acaciaControl` bridge. URL is visible in client bundle — this is by design (not a credential). ✅ ACCEPTED

### ✅ Fixed in v2.19.0 (June 29, 2026)

| # | Issue | File(s) | Severity |
|---|-------|---------|----------|
| 1 | SupportTickets module (`/SupportTickets`) had no permission manifest and no route/nav guard — all authenticated users had access regardless of role | `src/pages/permissions/support.permissions.js` (created), `src/components/Layout.jsx`, `src/pages/SupportTickets.jsx` | HIGH |
| 2 | `app_id` URL param could arrive as literal string `"null"` or `"undefined"` (broken build artefact), causing Base44 ObjectNotFoundError on login | `src/lib/app-params.js` (`cleanParamValue()`) | MEDIUM |
| 3 | `clear_access_token` URL flag was cached in storage via `getAppParamValue()`, silently wiping the token on every reload after logout | `src/lib/app-params.js` (read directly from URLSearchParams, not cached) | MEDIUM |
| 4 | Auth tokens moved from `sessionStorage` to `localStorage` (cross-tab session); security trade-off reviewed and documented | `src/lib/app-params.js`, `src/api/base44Client.js` | ACCEPTED RISK (documented) |

**Note on auth token storage (ACCEPTED RISK):** Tokens now live in `localStorage` so the session is shared across tabs, matching portfolio consistency. Residual risk: a future XSS could read the token; defence is CSP + no `unsafe-eval/innerHTML`. Token lifetime is controlled by the Base44 platform. This is explicitly accepted and documented.

### ✅ Fixed in v0.2.0

| # | Issue | File(s) | Severity |
|---|-------|---------|----------|
| 1 | Member role had admin-level CRUD on Catalogs | `src/pages/permissions/catalogs.permissions.js` | HIGH |
| 2 | Member role had admin-level CRUD on Investments | `src/components/investments/permissions.js` | HIGH |
| 3 | Member role had admin-level CRUD + Payment Reversal on Rentals | `src/components/rentals/permissions.js` | HIGH |
| 4 | Member role had admin-level CRUD on MSI (installment payments) | `src/pages/permissions/msi.permissions.js` | HIGH |
| 5 | Member role had write/modify/delete on Budget view section | `src/pages/permissions/budget.permissions.js` | MEDIUM |
| 6 | Goals page had no permission manifest | `src/pages/permissions/goals.permissions.js` (created) | HIGH |
| 7 | Messages page had no permission manifest | `src/pages/permissions/messages.permissions.js` (created) | HIGH |
| 8 | Savings Dashboard had no permission manifest | `src/pages/permissions/savings-dashboard.permissions.js` (created) | HIGH |
| 9 | Trips page had no permission manifest | `src/pages/permissions/trips.permissions.js` (created) | MEDIUM |
| 10 | Waitlist Admin had no permission manifest | `src/pages/permissions/waitlist-admin.permissions.js` (created) | MEDIUM |
| 11 | Permission snapshot regenerated with 187 entries | `base44/functions/dailyPermissionAudit/permissionManifests.ts` | INFO |

### ❌ Still Open from v0.1.0

The following critical issues were documented in v0.1.0 but remain unaddressed:

- ~~**jsPDF HTML Injection** (CVSS 9.6 Critical)~~ — ✅ FIXED in v0.3.0
- ~~**Axios SSRF + Prototype Pollution**~~ — ✅ FIXED via `npm audit fix` in v0.3.0
- ~~**No Content-Security-Policy headers**~~ — ✅ FIXED: CSP added to `public/_headers` in v0.3.0
- ~~**No npm audit step in CI pipeline**~~ — ✅ FIXED: `npm-audit` job added to CI in v0.3.0
- ~~**Token storage in localStorage**~~ — ✅ CLOSED in v0.6.0: auth tokens moved from persistent `localStorage` to `sessionStorage` (`src/lib/app-params.js`). The token no longer persists at rest across sessions or after the tab closes, and the `localStorage` copies the SDK writes are scrubbed on client init (`src/api/base44Client.js`) and on logout (`src/lib/AuthContext.jsx`). A full HttpOnly-cookie design remains a future option but requires Base44 platform/SDK support, since the SDK sends a Bearer token read from web storage.
- ~~**Missing JSON schema validation on AI responses**~~ — ✅ CLOSED in v2.18.0: the field-extraction result in `src/pages/Capture.jsx` is now validated with a `zod` schema (`aiExtractSchema`) before any value reaches the form — each field independently falls back to `undefined` if malformed, so a value like `amount: "abc"` or a wrong-typed id can never populate a transaction. Server-side, `scanReceipt` now coerces and validates every amount (`toAmount` → finite, positive) and drops invalid rows. The existing `try/catch` around `JSON.parse` (both call sites) already prevented crashes on non-JSON output.
- ~~**react-quill XSS**~~ — ✅ CLOSED in v0.5.0: package was unused and has been removed
- **xlsx prototype pollution / ReDoS** — LOW RESIDUAL RISK: xlsx is used write-only (`json_to_sheet` → `writeFile` from trusted internal data). The vulnerabilities are in the parse path which is never called. No user-supplied files are parsed.

---

## Dependency Vulnerabilities (Current State)

`npm audit` as of June 22, 2026 (v0.7.0) — **0 vulnerabilities** — all severity levels clear.

### ✅ ALL RESOLVED

| Package | Advisory | Issue | Resolved In |
|---------|----------|-------|-------------|
| ~~xlsx~~ | ~~GHSA-4r6h-8v6p-xvw6~~ | ~~Prototype pollution + ReDoS~~ | ✅ v0.6.0: replaced with `write-excel-file` |
| ~~quill / react-quill~~ | ~~GHSA-4943-9vgg-gr5r~~ | ~~XSS~~ | ✅ v0.5.0: package removed (was unused) |
| ~~esbuild < 0.28.1 via Vite 6.x~~ | ~~GHSA-gv7w-rqvm-qjhr~~ | ~~Missing binary integrity in Deno path~~ | ✅ v0.7.0: Vite updated to 6.4.3 (esbuild 0.25.12); advisory cleared by `npm audit fix` |
| ~~ws 8.0.0–8.20.1~~ | ~~GHSA-96hv-2xvq-fx4p~~ | ~~Memory exhaustion DoS~~ | ✅ v0.7.0: ws → 8.21.0 via `npm audit fix` |
| ~~@opentelemetry/core < 2.8.0 (×9 packages)~~ | ~~GHSA-8988-4f7v-96qf~~ | ~~Unbounded memory in W3C Baggage~~ | ✅ v0.7.0: ecosystem updated via posthog-js upgrade |
| ~~dompurify ≤ 3.4.10~~ | ~~GHSA-x4vx-rjvf-j5p4 et al.~~ | ~~XSS in IN_PLACE mode (×4 advisories)~~ | ✅ v0.7.0: dompurify → 3.4.11 via jspdf/posthog-js |
| ~~@babel/core ≤ 7.29.0~~ | ~~GHSA-4x5r-pxfx-6jf8~~ | ~~Arbitrary File Read via sourceMappingURL~~ | ✅ v0.7.0: @babel/core → 7.29.7 via @vitejs/plugin-react |

**CI gate**: `npm audit --audit-level=critical` blocks merges on critical vulnerabilities. Current status: PASS (0 findings).

---

## Permission System Audit (v0.2.0 Findings)

### Design Principle Applied
- **Admin role**: all permissions `true` by default
- **Member role**: all permissions `false` by default; admin explicitly grants access via Permission Admin panel

### Fixed Modules

#### Catalogs (categories, subcategories, persons, payment methods)
- **Before**: Members could create, edit, delete all catalog entries (identical to admin)
- **After**: Members can only view catalog entries; CRUD actions are `false` and hidden

#### Investments
- **Before**: Members could create, edit, delete investments and record/view payment history
- **After**: Members can only view the investment list and details; all CRUD and payment actions closed

#### Rentals
- **Before**: Members could register, edit, delete properties; record AND reverse rental payments
- **After**: Members can only view property list and details; all management and payment actions closed

#### MSI (Installment Payments)
- **Before**: Members could create, edit, delete MSI records and record payments
- **After**: Members can view MSI list, tracking, and detail sheet only; CRUD and payment actions closed

#### Budget
- **Before**: Members' `budget.view` section had `can_write`, `can_modify`, `can_delete` all `true`
- **After**: Fixed to read-only (`can_read: true, can_view: true`, all others `false`)

### New Permission Manifests Added

| Page | Module Key | Order | Member Default |
|------|-----------|-------|----------------|
| Goals | `module.Goals` | 12 | View only; CRUD closed |
| Messages | `module.Messages` | 20 | View only; Send/Delete closed |
| Savings Dashboard | `module.SavingsDashboard` | 22 | All closed (admin explicit grant) |
| Trips | `module.Trips` | 23 | View only; Manage closed |
| Waitlist Admin | `module.WaitlistAdmin` | 24 | All closed (platform admin only) |

---

## Code-Level Security Issues

### 🔴 CRITICAL (3) — UNRESOLVED FROM v0.1.0

#### 1. Sensitive Token Storage in localStorage
- **Files**: `/src/lib/app-params.js`, `/src/api/base44Client.js`, `/src/lib/AuthContext.jsx`
- **Risk**: Tokens persisting in `localStorage` are readable by XSS and linger at rest across sessions / after the tab closes
- **Status**: ✅ FIXED in v0.6.0 — tokens moved to `sessionStorage`; legacy `localStorage` tokens migrated once then cleared; SDK-written `localStorage` copies scrubbed on init and logout

#### 2. Insecure Token Extraction from URL Parameters
- **Files**: `/src/lib/app-params.js`
- **Risk**: Tokens in browser history, server logs, referrer headers
- **Status**: ⚠️ PARTIALLY MITIGATED — `access_token` is read with `removeFromUrl: true`, which strips it from the address bar via `history.replaceState` immediately after read (no browser-history entry). The token still transits the initial URL; fully eliminating that requires a cookie/redirect handshake on the Base44 platform side.

#### 3. Unsafe JSON Parsing of Untrusted AI Responses
- **Files**: `/src/pages/Capture.jsx`, `/base44/functions/scanReceipt/entry.ts`
- **Risk**: Schema-less parse of AI output; malformed/hostile values reaching the form or a transaction
- **Status**: ✅ RESOLVED in v2.18.0 — `Capture.jsx` validates the extracted result with a `zod` schema before applying it; `scanReceipt` coerces/validates every amount and drops invalid rows. `JSON.parse` was already wrapped in `try/catch` at both call sites (no crash on non-JSON).

### 🟠 HIGH (5) — UNRESOLVED FROM v0.1.0

1. Missing input validation on numeric fields (`TransactionEditModal.jsx:89`, `Capture.jsx:125-128`)
2. Unvalidated external API response from exchange rate service (`exchangeRateService.js:9-14`)
3. Missing CSRF protection mechanism
4. Base44 SDK `requiresAuth: false` may bypass auth (`base44Client.js:7-14`)
5. No Content-Security-Policy headers in vite config

### 🟠 HIGH (4) — NEW IN v0.2.0

#### 6. Missing Trips Permission Enforcement (Partial)
- **File**: `/src/pages/Trips.jsx`
- **Issue**: Page uses `useFeatureGate('page.Trips')` which is a billing gate, NOT the new `trips.permissions.js` RBAC gate
- **Risk**: Feature-gate bypass doesn't enforce family-level RBAC
- **Recommendation**: Add `usePermission('trips.view.list')` guard alongside the feature gate

#### 7. WaitlistAdmin Relies on Role Check Only
- **File**: `/src/pages/WaitlistAdmin.jsx` (line: `const isPlatformAdmin = currentUser?.role === 'admin'`)
- **Issue**: The client-side role string comparison is only a UI guard.
- **Status**: ✅ RESOLVED / VERIFIED in v2.18.0 — server-side enforcement is present: `base44/functions/listWaitlist/entry.ts` rejects non-admin callers (`if (caller.role !== 'admin') return 403`) and reads via `asServiceRole`. The client check is defense-in-depth, not the authorization boundary. Additionally, the `WaitlistSignup` entity has admin-only RLS on all operations (read/create/update/delete), protecting the email PII; public signups go through `joinWaitlist`, which uses `asServiceRole`.

#### 8. Messages Page — No Authorization on Message Access
- **File**: `/src/pages/Messages.jsx`
- **Issue**: No permission gate visible at page load; any authenticated user can view/send messages
- **Recommendation**: Add `usePermission('messages.view.inbox')` guard; enforce recipient ownership server-side

#### 9. Goals Page — Delete Without Confirmation
- **File**: `/src/pages/Goals.jsx`
- **Issue**: `deleteMutation` called directly on `handleDelete`; no confirmation dialog observed in page code
- **Risk**: Accidental permanent data loss
- **Recommendation**: Add confirmation dialog before delete mutation

### 🟡 MEDIUM (6) — UNRESOLVED FROM v0.1.0

1. Inadequate error logging with potential PII (AuthContext.jsx, AIUsage.jsx)
2. Unencrypted sensitive data in localStorage (useTutorialState.js, useMemory.js, FamilyContext.jsx)
3. Missing rate limiting on AI API calls (Capture.jsx:108-120)
4. Insufficient JSON.parse validation (FloatingActionButton.jsx:38, navigationStack.js:56,81)
5. Analytics data exposure in PostHog (analytics.js:21-22)
6. Unencrypted receipt images in storage (receiptCompression.js)

### 🟢 LOW (2) — UNRESOLVED FROM v0.1.0

1. XSS via dangerouslySetInnerHTML in chart.jsx (currently safe, risk if config becomes dynamic)
2. Overly broad error suppression (silent try-catch blocks)

---

## Test Coverage Assessment

### ✅ Strengths
- Deno test infrastructure in place (`base44/functions/_agentGuard.test.ts`)
- CI/CD pipeline with linting and testing (GitHub Actions)
- TypeScript/JSDoc type checking enabled
- Permission snapshot auto-sync in build pipeline

### ⚠️ Gaps (Unchanged from v0.1.0)
- No unit tests for React components
- No integration tests for auth or permissions flow
- No security/penetration tests
- Estimated coverage: <30%

---

## CI/CD Pipeline Assessment

### ✅ Current Implementation
- Deno linting and tests on push/PR
- GitHub Actions workflow configured
- Permission snapshot sync in build script
- Docs snapshot sync in build script

### ⚠️ Gaps (Unchanged from v0.1.0)
- No `npm audit` step in CI
- No SAST tooling
- No Dependabot configured
- No secrets scanning

**Recommendation**: Add `npm audit --audit-level=high` as a required CI step before build.

---

## Architecture & Design Issues

### ✅ Strengths
- Base44 SDK provides secure data layer
- Entity-based access control
- Role-based permission system with aggregated manifests
- Protected routes implementation
- Permission Admin panel for runtime permission customization
- Secure defaults: admin=all-true, member=all-false (now enforced after this audit)

### ⚠️ Concerns (Carry-Forward)
- Heavy reliance on Base44 SDK (proprietary vendor lock-in)
- WaitlistAdmin backend function `listWaitlist` server-side authorization not independently verified — client-side `enabled: isPlatformAdmin` guard is in place; backend is expected to enforce role check
- ~~localStorage token storage~~ — ✅ RESOLVED v0.6.0: tokens moved to `sessionStorage`

---

## Summary Table (v0.7.0 — Current)

| Category | Status | Severity | Change |
|----------|--------|----------|--------|
| ~~Dependency Vulnerabilities (19)~~ | ✅ RESOLVED | CRITICAL/HIGH | Fixed v0.3.0 (npm audit fix, jsPDF update) |
| ~~Token Security (localStorage)~~ | ✅ RESOLVED | CRITICAL | Fixed v0.6.0 → sessionStorage |
| ~~react-quill XSS~~ | ✅ RESOLVED | MODERATE | Fixed v0.5.0 → package removed |
| ~~react-router open redirect~~ | ✅ RESOLVED | MODERATE | Fixed v0.5.0 → npm audit fix |
| ~~Permission Privilege Escalation (5 modules)~~ | ✅ RESOLVED | HIGH | Fixed v0.2.0 |
| ~~Missing Permission Manifests (5 pages)~~ | ✅ RESOLVED | HIGH | Fixed v0.2.0 |
| ~~SavingsDashboard missing permission gate~~ | ✅ RESOLVED | MEDIUM | Fixed v0.5.0 |
| ~~usePermission dbPerms null-field defaults to true~~ | ✅ RESOLVED | MEDIUM | Fixed v0.5.0 |
| ~~RLS: family-scoped entities missing platform-admin override~~ | ✅ RESOLVED | CRITICAL | Fixed v0.5.0 (PR #121) |
| ~~ConversationSession RLS: family-wide read~~ | ✅ RESOLVED | CRITICAL | Fixed v0.5.0 (PR #121) |
| ~~xlsx prototype pollution/ReDoS~~ | ✅ RESOLVED | HIGH | Fixed v0.6.0 → replaced with `write-excel-file` |
| ~~esbuild GHSA-gv7w-rqvm-qjhr (via Vite 6.x)~~ | ✅ **RESOLVED** | HIGH | Fixed v0.7.0 → Vite 6.4.3 + npm audit fix; 0 findings |
| ~~ws GHSA-96hv-2xvq-fx4p~~ | ✅ **RESOLVED** | HIGH | Fixed v0.7.0 → ws 8.21.0 |
| ~~@opentelemetry GHSA-8988-4f7v-96qf (×9)~~ | ✅ **RESOLVED** | MODERATE | Fixed v0.7.0 → posthog-js updated |
| ~~dompurify XSS (×4 advisories)~~ | ✅ **RESOLVED** | MODERATE | Fixed v0.7.0 → dompurify 3.4.11 |
| ~~@babel/core GHSA-4x5r-pxfx-6jf8~~ | ✅ **RESOLVED** | LOW | Fixed v0.7.0 → @babel/core 7.29.7 |
| ~~Missing JSON schema validation on AI responses~~ | ✅ **RESOLVED** | LOW | Fixed v2.18.0 → `zod` validation in `Capture.jsx` + amount validation in `scanReceipt` |
| ~~WaitlistAdmin backend auth unverified~~ | ✅ **RESOLVED/VERIFIED** | INFO | v2.18.0: `listWaitlist` enforces `role !== 'admin' → 403`; `WaitlistSignup` RLS is admin-only |
| ~~PublicSnapshot direct read too broad~~ | ✅ **RESOLVED** | LOW | v2.18.0: entity `read` RLS tightened to admin-only; public access is served by `getPublicSnapshot` via `asServiceRole` |
| Test Coverage (<30%) | ⚠️ OPEN | MEDIUM | Deferred — no test framework for React components |

---

## Immediate Action Items (v2.18.0)

No blocking items remain. `npm audit` reports 0 vulnerabilities. All critical, high, and medium security issues are resolved.

**Closed in v2.18.0:**
1. **AI response schema validation** — `zod` validation added in `Capture.jsx`; `scanReceipt` validates/coerces amounts. No longer deferred.
2. **WaitlistAdmin backend auth** — Verified: `listWaitlist` enforces platform-admin server-side; `WaitlistSignup` RLS is admin-only.
3. **RLS hardening** — `PublicSnapshot` read tightened to admin-only (public access is served exclusively by the `getPublicSnapshot` service-role function). `WaitlistSignup` confirmed admin-only on all operations.

> **Note on the WaitlistSignup advisor suggestion:** the platform advisor proposed allowing *any authenticated user* to create waitlist rows. We intentionally **did not** apply this — it would weaken a table holding email PII. Public signups already work via `joinWaitlist` (`asServiceRole`), so admin-only `create` is both safe and stricter.

**Deferred (low risk):**
1. **Test Coverage (<30%)** — no React component test framework yet.

---

## CI/CD Pipeline Assessment (v0.5.0)

### ✅ Current Implementation
- `npm-audit` CI job added — gates on `--audit-level=critical`; moderate/high documented but permitted for xlsx (no fix) and react-router (now fixed)
- Deno linting and tests on push/PR
- GitHub Actions workflow configured
- Permission snapshot sync in build script
- Docs snapshot sync in build script

### ⚠️ Gaps
- No SAST tooling
- No Dependabot configured
- No secrets scanning
- No unit tests for React components (<30% coverage)

---

## Compliance & Regulatory Notes

⚠️ Application handles **financial data** and **family PII**.

- **PCI-DSS**: Not compliant — requires significant security hardening before payment data handling
- **GDPR**: Not compliant — requires data protection audit if serving EU users
- **SOC 2**: Recommended for financial applications; not currently achievable with current test coverage

---

**Report Generated**: July 6, 2026 (v2.20.0)
**Previous Report**: June 29, 2026 (v2.19.0)
**Next Review**: August 6, 2026 (recommended)
**Audit Scope**: Full codebase, permissions, dependencies, CI/CD, documentation
