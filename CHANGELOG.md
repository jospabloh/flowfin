# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Versioning note (2.18.0):** FlowFin previously carried two parallel version
> numbers — an engineering line in `package.json`/this changelog (…0.7.0) and a
> product line shown in-app (…2.17.0). These are now **unified onto the product
> 2.x line**. `package.json`, this changelog, the in-app *Acerca de* history and
> the update banner all read the same number going forward. Entries at `0.x`
> below are retained as historical engineering-line records.

## [2.20.2] - 2026-07-06

### 🔒 Security

- **MEDIUM → FIXED**: SSRF hardening in the Mercado Pago webhook
  (`mpWebhook/entry.ts`). The inbound `data.id` / `id` field was interpolated
  directly into the outbound `fetch` to `https://api.mercadopago.com/v1/payments/<id>`
  without format validation. It is now rejected with `400 invalid_data_id`
  unless it matches `/^\d+$/`, before signature verification or the outbound
  call. Note: the value is already part of the HMAC-signed payload
  (`id:<data.id>;request-id:...;ts:...`), so exploiting this required a valid
  webhook signature — this change is defense-in-depth, not a closure of an
  unauthenticated path.

## [2.20.1] - 2026-07-06

### 🔒 Security

- **HIGH → FIXED**: Two maintenance handlers exposed under the `maintenance`
  router — `debugFiniaData` and `testAgentMultiFamilySupport` — only checked
  that the caller was authenticated, so **any signed-in user** could invoke them
  and read their family's configuration (category/person/transaction counts,
  member names, currency) assembled via `asServiceRole`. Both now require
  `role === 'admin'` and return `403 Forbidden` otherwise, matching the guard
  already used by the sibling `backfill*`/`fix*`/`migrate*` handlers. The
  self-service `repairUserData` handler is intentionally left open — it only
  repairs the **caller's own** `family_id` via `auth.updateMe()` and leaks no
  cross-tenant data.

> ⚠️ Base44 backend functions do **not** auto-deploy from GitHub. This fix only
> takes effect at runtime after `npx base44 functions deploy --app-id
> 69b97ea9c9a713486b5a01fd --force` (see `CLAUDE.md`).

## [2.20.0] - 2026-07-06

### 🔒 Security & Permissions

- **MEDIUM → FIXED**: `module.Trips` and `module.Goals` navigation visibility was hardcoded to `true` in `Layout.jsx`, bypassing the DB-backed permission system. An admin who revoked these module permissions in the Permission Admin panel saw no effect — the nav item persisted for all members. Fixed: `Layout.jsx` now reads `useCanView('module.Trips')` and `useCanView('module.Goals')`, respecting the `RolePermission` records seeded by `createFamily` and backfilled by `backfillModulePermissions`. Default member access unchanged (both are `can_view: true` from the DB seed).

- **HIGH → FIXED (PRs #159/160)**: RLS for `Trip` and `SupportTicketMessage` entities now scopes reads by declared owner field (`created_by_id`), closing a path where members of one family could query rows belonging to another family. Audit gate: `npm run validate:rls` — 36 entities OK.

### ✨ Features

- **Active Session Tracking (PR #166)** — new `AppSession` entity tracks each browser login with one row per session. `SessionHeartbeat.jsx` (mounted app-wide) creates the session row on login and sends heartbeats every 60 s, updating `last_active_at`. On each heartbeat the client checks its own row: if ACACIA Mission Control sets `revoked_at`, the user is logged out immediately. RLS: authenticated users can only create/read/update their own rows (`created_by_id`); the `acaciaControl` bridge running as service role can list and revoke any session for Mission Control operators.

- **Mission Control push for Support Tickets (PR #161/162)** — when a support ticket is created, FlowFin sends a fire-and-forget HTTP POST to the ACACIA Mission Control ingest endpoint carrying only the ticket ID. Mission Control reads the full ticket through the authenticated `acaciaControl` bridge, avoiding a new Base44 function (Base44 caps apps at 50 functions; FlowFin had reached the limit).

- **Backend function consolidation (PRs #163/164)** — backend functions reorganised from 94 individual endpoints into 48 endpoints under 8 router functions, fitting within Base44's 50-function-per-app limit. All existing API surface preserved. Routers: `analytics`, `family`, `maintenance`, `catalog`, `acaciaControl`, `trips`, `support`, `sessions`.

### 📝 Docs

- **CLAUDE.md** (PR #165) — deploy reminder added to the repo: merging a PR to `main` redeploys only the frontend; functions under `base44/functions/` must be deployed separately with `npx base44 functions deploy --app-id <APP_ID> --force`.

### 🔧 Maintenance

- **Lint fix (PR #167)** — removed unused `UserPlus` import from `src/pages/Register.jsx`.
- **Base44 packages** — `@base44/vite-plugin` updated to 1.0.25.

### 🔖 Version
- Bumped `package.json` from `2.19.0` → `2.20.0`.
- Permission snapshot regenerated: `module.Trips` and `module.Goals` now correctly read from the DB-backed permission system in `Layout.jsx`.
- Security audit report updated to v2.20.0.

### ⚠️ Known Open Issues (Carry-Forward)
- **INFO**: `xlsx` LOW residual risk (parse path unused, write-only export). No upstream fix — accepted.
- **INFO**: Test coverage <30% — deferred, no React component test framework yet.

---

## [2.19.0] - 2026-06-29

### ✨ Features

- **Support Tickets** — new `/SupportTickets` module lets every family member open, track, and reply to support tickets directly inside FlowFin. Tickets are scoped by `family_id` (RLS enforced). New entities: `SupportTicket`, `SupportTicketMessage`. New page: `src/pages/SupportTickets.jsx`. Admin control function `acaciaControl` gains ticket list / thread / update actions for Mission Control.

- **Persistent cross-tab session** — auth tokens now live in `localStorage` (previously `sessionStorage`), matching the rest of the ACACIA portfolio. Opening a new tab reuses the existing session without re-login. Security trade-off reviewed and documented in `src/lib/app-params.js` (XSS defence stays on CSP + no `unsafe-eval/innerHTML`; token lifetime controlled by Base44 platform). A one-time migration moves all session keys from `sessionStorage` to `localStorage` so currently signed-in users are not logged out on deploy.

- **"Continue as" login card** — returning users see a one-tap card on the login screen with their name and avatar (Uber Eats–style). Backed by `src/lib/lastIdentity.js` which stores only name/email/avatar — **never the access token**. Cleared on explicit logout or "use another account". `BASE44_PUBLIC_APP_ID` moved to its own module (`src/lib/base44-app.js`) so `app-params.js` carries no inline identifiers.

- **acaciaControl bridge function** — admin-only backend function connecting FlowFin to ACACIA Mission Control. Actions: usage summary, per-tenant usage, license management, email status and follow-up, tenant contacts, and ticket list/thread/update. All protected by an `_internalGuard.ts` that rejects requests not originating from the trusted Mission Control origin.

### 🔒 Security & Permissions

- **HIGH → FIXED**: `SupportTickets` module (`/SupportTickets` route) was accessible to all authenticated users with no permission check. Added `src/pages/permissions/support.permissions.js` (6 keys: `support.view`, `support.view.list`, `support.view.thread`, `support.ticket`, `support.ticket.create`, `support.ticket.reply`). Updated `Layout.jsx` to gate the nav item on `module.SupportTickets`. Updated `SupportTickets.jsx` to render an access-denied fallback when `module.SupportTickets` is not visible. Defaults: admin all-true; member view + create/reply true (support tickets are a user-facing channel for all family roles). Permission snapshot regenerated — 215 declared keys (+7 vs v2.18.0), 0 missing.

- **auth: `app_id` null-string guard** — `cleanParamValue()` normalises the literal strings `"null"` and `"undefined"` (which a broken build can persist in storage or inject via `?app_id=null`) to `undefined`, preventing Base44 from receiving `by-id/null` and returning `ObjectNotFoundError` on login.

- **auth: `clear_access_token` one-shot URL flag** — was read through the generic `getAppParamValue()` which persists every value it reads; the flag was being cached in storage, wiping the token on every reload after logout. Fixed to read directly from `URLSearchParams` without caching.

- **CI: `validate:rls` guard** — added `npm run validate:rls` step to the CI workflow, verifying the 35 Base44 entity schemas pass RLS checks on every push. Currently a static analysis step; failures block the merge gate.

### 🔖 Version
- Bumped `package.json` from `2.18.0` → `2.19.0`.
- Permission snapshot updated: 215 keys (was 208 after 0.x entries; +7 new support module keys). 0 missing declared/used keys.

### 📝 Docs
- User manual updated to v2.19.0: documents Support Tickets module, session/tab-sharing behaviour, "Continue as" login, and revised permissions for the support module.

### ⚠️ Known Open Issues (Carry-Forward)
- **INFO**: `xlsx` LOW residual risk (parse path unused, write-only export). No upstream fix — accepted.
- **INFO**: WaitlistAdmin `listWaitlist` server-side auth not independently verified; client-side `enabled: isPlatformAdmin` guard is in place.

---

## [2.18.0] - 2026-06-22

### ✨ Features
- **Command Palette (⌘K / Ctrl+K)** — a global, keyboard-first launcher that
  unifies navigation across the app's 20+ modules. Fuzzy-search and jump to any
  destination the current user is permitted to see (it reuses the sidebar's
  permission source of truth, so the two can't drift), plus quick actions:
  registrar movimiento, preguntar a Finia, crear meta, planear viaje, cambiar
  tema. Search works in Spanish and English. New component
  `src/components/CommandPalette.jsx`, wired into `src/components/Layout.jsx`;
  reuses the existing `cmdk` primitive (`src/components/ui/command.jsx`).
- **Keyboard shortcut "N"** opens transaction capture instantly. Guarded so it
  never fires while typing or while a modal/sheet/drawer is open.
- Visible **"Buscar… ⌘K"** trigger in the desktop sidebar and a search button
  in the mobile top bar.

### 🔖 Version
- **Unified versioning onto the 2.x product line.** `package.json` `0.7.0 → 2.18.0`;
  in-app *Acerca de* history and Release Notes advanced to `2.18.0`; the update
  banner build constant (`AppUpdateBanner.jsx`) corrected `2.11.0 → 2.18.0`
  (it had silently drifted behind the product line).

### 📝 Docs
- User manual, changelog and in-app release notes synchronized to 2.18.0.
- Permissions matrix unchanged: the Command Palette introduces **no new
  permission keys** (it reuses existing `module.*` view permissions), so the
  208-key matrix and defaults are intact.

### 🌐 Marketing site (acaciaco-site)
- The FlowFin product page now markets the real feature set (AI assistant,
  receipt OCR, reports with export, investments, rentals, multi-currency trips,
  MSI) and corrects the plan member counts (Home **1–4**, Family+ **5–10**).
  Prices unchanged. Tracked in `jospabloh/acaciaco-site`.

## [0.7.0] - 2026-06-22

### 🔒 Security (Dependency Remediation — All Tenants)
- **HIGH → RESOLVED**: `esbuild` < 0.28.1 via Vite 6.x (GHSA-gv7w-rqvm-qjhr) — accepted in v0.6.0 as a build-tool-only Deno-path advisory. `npm audit fix` updated Vite to 6.4.3 which bundles esbuild 0.25.12; subsequent advisory evaluation now returns **0 vulnerabilities** across all severity levels. The accepted-risk classification is formally closed.
- **HIGH → RESOLVED**: `ws` 8.0.0–8.20.1 → 8.21.0 (GHSA-96hv-2xvq-fx4p) — Memory exhaustion DoS from tiny fragments. Transitive via `@base44/sdk` → `socket.io-client` → `engine.io-client`. Production dependency chain.
- **MODERATE → RESOLVED (×9)**: `@opentelemetry/core` ecosystem (GHSA-8988-4f7v-96qf — Unbounded memory allocation in W3C Baggage propagation). Transitive via `posthog-js`. All nine affected `@opentelemetry/*` packages updated to patched versions.
- **MODERATE → RESOLVED (×4)**: `dompurify` ≤ 3.4.10 → 3.4.11 (GHSA-x4vx-rjvf-j5p4, GHSA-76mc-f452-cxcm, GHSA-hpcv-96wg-7vj8, GHSA-r47g-fvhr-h676) — Multiple XSS issues in `IN_PLACE` sanitization mode. Transitive via `jspdf` and `posthog-js`.
- **LOW → RESOLVED**: `@babel/core` ≤ 7.29.0 → 7.29.7 (GHSA-4x5r-pxfx-6jf8 — Arbitrary File Read via `sourceMappingURL` comment). Transitive via `@vitejs/plugin-react`. Build-tool devDependency only.
- **Summary**: `npm audit fix` applied — 15 vulnerabilities resolved (3 high, 11 moderate, 1 low). `npm audit` now reports **0 vulnerabilities** (0 critical, 0 high, 0 moderate, 0 low).

### 🔐 Code Quality
- Permission snapshot date refreshed: `permissionManifests.ts` last-synced timestamp updated from 2026-06-15 → 2026-06-22. No permission matrix changes — all 208 declared keys and defaults are unchanged.
- Permissions coverage report regenerated: 208 declared keys, 85 used in source, 0 missing, 73 orphaned (declared but not yet wired to code — carry-forward, no security impact).

### 🔖 Version
- Bumped `package.json` from `0.6.0` → `0.7.0`.

### ⚠️ Known Open Issues (Carry-Forward)
- **INFO**: WaitlistAdmin backend function `listWaitlist` server-side authorization not independently verified — client-side guard (`enabled: isPlatformAdmin`) is in place.
- **LOW**: Missing JSON schema validation on AI responses (Capture.jsx) — deferred.

---

## [0.6.0] - 2026-06-15

### 🔒 Security (Dependency Remediation — All Tenants)
- **HIGH → RESOLVED**: Replaced the unmaintained `xlsx` (SheetJS) dependency with `write-excel-file` for the Transactions Excel export. This eliminates the prototype pollution / ReDoS advisories (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) that had no upstream fix. The export output is unchanged — same columns, sheet name (`Movimientos`), and `FlowFin_YYYY-MM-DD.xlsx` filename. (`src/pages/Transactions.jsx`)
- **HIGH — ACCEPTED (build-tool, not runtime)**: `esbuild` < 0.28.1 (transitively via Vite 6.x) is flagged by `npm audit` for GHSA-gv7w-rqvm-qjhr (CVSS 8.1) — missing binary-integrity verification in esbuild's **Deno** download path, enabling RCE when `NPM_CONFIG_REGISTRY` is attacker-controlled. Risk assessment: esbuild is a **build-time devDependency only** — it is not deployed to production, not run in a Deno context, and the vulnerable download mechanism is not invoked in the Node.js/npm workflow used by this project. Fix requires upgrading Vite to v8.x (breaking change). Deferred to a dedicated Vite upgrade sprint; accepted residual risk for build tooling.

### 🖱️ UX Improvement (All Tenants)
- **Date pickers now open on full-field tap**: Native `<input type="date">` and `<input type="month">` fields across the app now call `showPicker()` on click, so the calendar opens when tapping anywhere on the field — not only when tapping the browser's calendar icon. Affects: Reports filters, License Admin, MSI, Investments, Scheduled Payments, Rentals, Goals, and Trips forms. (`src/components/goals/GoalFormModal.jsx`, `src/components/investments/InvestmentFormSheet.jsx`, `src/components/investments/InvestmentPayFormModal.jsx`, `src/components/rentals/RentalPaymentSheet.jsx`, `src/components/scheduled/ScheduledPaymentMarkPaidSheet.jsx`, `src/components/trips/TripFormModal.jsx`, `src/pages/LicenseAdmin.jsx`, `src/pages/MSIPage.jsx`, `src/pages/Reports.jsx`)

### 🔖 Version
- Bumped `package.json` from `0.5.0` → `0.6.0`.

### ⚠️ Known Open Issues (Carry-Forward)
- **HIGH (accepted)**: esbuild GHSA-gv7w-rqvm-qjhr — build-tool only, Deno-specific path, not production. Fix requires Vite v8 upgrade (deferred).
- **INFO**: WaitlistAdmin backend function `listWaitlist` server-side authorization not independently verified — client-side guard (`enabled: isPlatformAdmin`) is in place.

## [0.5.0] - 2026-06-08

### 🔒 Security (RLS Hardening — All Tenants)
- **CRITICAL → RESOLVED**: Added platform-admin (`user_condition.role == "admin"`) override to the row-level security (`rls`) rules of all family-scoped entities flagged by the Base44 security scanner, bringing them in line with the existing `Family`/`FamilyConfig` pattern (platform admin **or** family member). Entities updated for `create`/`read`/`update`/`delete`: `Category`, `CategoryBudget`, `Goal`, `Investment`, `InvestmentPayment`, `MSI`, `MSIPayment`, `PaymentMethod`, `Person`, `RentalPayment`, `RentalProperty`, `ScheduledPayment`, `ScheduledPaymentRecord`, `Subcategory`, `Transaction`, `Trip`. Existing family-scoped access is unchanged; only grants platform admins the ability to manage tenant data for support purposes.
- **CRITICAL → RESOLVED**: Reworked `ConversationSession` RLS so platform admins can manage all sessions while regular users can only access and modify **their own** sessions (`data.user_id == {{user.id}}`) across all four operations. Read access is no longer family-wide, matching the principle that conversation history is per-user; consuming functions already query by `user_id` (or run as service role), so there is no behavior regression.

### 🔒 Security (Permission Enforcement — All Tenants)
- **MEDIUM → FIXED**: `SavingsDashboard` page had no component-level permission gate. Members with `savings.view.can_view: false` (the default) could access the AI-powered savings analysis. Added `useCanView('savings.view')` check with redirect to `/Dashboard`. (`src/pages/SavingsDashboard.jsx`)
- **MEDIUM → FIXED**: `usePermission` hook's DB-record fallback used `?? true` for all five permission fields (`can_read`, `can_write`, `can_modify`, `can_delete`, `can_view`). A partial `RolePermission` record in the database with null fields would default those to `true`, potentially granting unintended write/delete/modify access. Changed all fallbacks to `?? false` (deny-by-default). (`src/lib/permissions/usePermission.js`)

### 🔒 Security (Dependency Update — All Tenants)
- **MODERATE → RESOLVED**: Updated `react-router` from 6.26.x to the patched version via `npm audit fix` — eliminates same-origin open-redirect vulnerability via protocol-relative URL reinterpretation (GHSA-2j2x-hqr9-3h42).

### 🔖 Version
- Bumped `package.json` from `0.4.0` → `0.5.0`.

### ⚠️ Known Open Issues (Carry-Forward)
- **HIGH**: `xlsx` prototype pollution/ReDoS (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) — no upstream fix available. Used write-only (`json_to_sheet` → `writeFile`); parse path is never called. Accepted residual risk.
- **INFO**: WaitlistAdmin backend function `listWaitlist` server-side authorization not independently verified in this audit — backend is expected to enforce platform-admin role check; client-side guard (`enabled: isPlatformAdmin`) is in place.

---

## [0.4.0] - 2026-06-01

### 🔒 Security / Code Quality (All Tenants)
- **LOW**: Removed unused `Info` import in `src/components/finia/FiniaMessageBubble.jsx` — resolves ESLint lint failure that blocked clean CI runs.

### 📚 Documentation
- **Retroactive CHANGELOG entry for v0.3.0** — dependency security updates, CSP headers, and CI audit gate from PR #110 are now formally documented.
- Updated `SECURITY_AUDIT_REPORT.md` with v0.4.0 audit status, confirmed remaining open items, and closed previously outstanding findings.
- Updated `USER_MANUAL.md` with current permission model and release notes.

### 🔖 Version
- Bumped package.json from 0.2.0 → 0.4.0 (v0.3.0 code changes were shipped in PR #110 without a version bump; this release formally documents the 0.3.0 delta and adds the current 0.4.0 fixes).

### ⚠️ Known Open Issues (Carry-Forward)
- **HIGH**: xlsx prototype pollution/ReDoS (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) — no upstream fix; sanitize file input before parsing.
- **MODERATE**: react-quill/quill XSS (GHSA-4943-9vgg-gr5r) — upstream fix requires breaking downgrade; evaluate editor replacement.
- **HIGH**: Authentication tokens stored in localStorage — architectural change required; low immediate risk since token is removed from URL after use.
- **INFO**: WaitlistAdmin backend function `listWaitlist` server-side authorization not verified in this audit — ensure backend enforces platform-admin role check independently.

---

## [0.3.0] - 2026-06-01

> **Note**: These changes were shipped in PR #110 (`claude/hopeful-euler-9kai9`) without a formal CHANGELOG entry or version bump. Retroactively documented here.

### 🔒 Security Fixes (All Tenants)
- **CRITICAL → RESOLVED**: jsPDF updated to v4.2.1, eliminating HTML injection vulnerability (GHSA-wfv2-pwc8-crg5, CVSS 9.6).
- **HIGH × 8 → RESOLVED**: `npm audit fix` applied — axios, flatted, lodash, minimatch, picomatch, rollup, socket.io-parser, vite all updated to safe versions.
- **NEW**: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy headers added to `public/_headers`.
- **NEW**: `npm-audit` CI job added to `.github/workflows/ci.yml` — blocks merges on critical dependency vulnerabilities.
- **NEW**: `setup-deno` upgraded to v2 in `.github/workflows/deno.yml`.
- Permission gates added to Goals, Messages, and Trips pages (`usePermission` for action-level gating).

### 📚 Documentation
- `SECURITY_AUDIT_REPORT.md` updated with v0.3.0 resolution status.

### ⚠️ Remaining After v0.3.0
- xlsx and react-quill/quill vulnerabilities remain — no upstream fix.
- Token storage in localStorage — architectural concern.
- npm audit vulnerability count: 3 (0 critical, 1 high [xlsx], 2 moderate [quill]).

---

## [0.2.0] - 2026-06-01

### 🔒 Security Fixes (All Tenants)
- **HIGH**: Fixed privilege-escalation misconfiguration — `member` role previously had admin-level CRUD permissions on Catalogs, Investments, Rentals, and MSI modules. Members now default to view-only; all write/delete actions require explicit admin grant.
- **MEDIUM**: Fixed `budget.view` section permission for `member` role — `can_write`, `can_modify`, `can_delete` were incorrectly `true`; corrected to read-only.
- **INFO**: Regenerated permission snapshot (`permissionManifests.ts`) with 187 entries reflecting all fixes.

### 🆕 New Permission Manifests (All Tenants)
Five new pages were added to the app without RBAC manifests. Manifests created with secure defaults (admin: all true; member: closed):

| Page | Module Key | Member Default |
|------|-----------|----------------|
| Goals | `module.Goals` | View only; Manage closed |
| Messages | `module.Messages` | View only; Send/Delete closed |
| Savings Dashboard | `module.SavingsDashboard` | All closed — admin grants |
| Trips | `module.Trips` | View only; Manage closed |
| Waitlist Admin | `module.WaitlistAdmin` | All closed — platform admin only |

### 🆕 New Features
- **Goals** (`/goals`): Create, track, and share financial savings goals. Visualize progress with goal cards and shareable snapshots.
- **Messages** (`/messages`): Family messaging system with categorized threads (General, Payment, Income, Movement). Send financial notes to family members.
- **Savings Dashboard** (`/savings`): AI-powered analysis of the last 6 months identifying forgotten subscriptions and non-essential spending opportunities. Estimated monthly savings surfaced in summary.
- **Trips** (`/trips`): Track travel expenses by destination. Associate transactions to trips; view active and historical trips with full spending breakdown.
- **Waitlist Admin** (`/waitlist-admin`): Platform-admin tool to manage user waitlist, send invitations individually or in bulk, and track registration status.
- **Release Notes** page: In-app version release notes accessible from the main menu.

### 🐛 Bug Fixes (All Tenants)
- Deno linter errors resolved in backend functions (`finiaGetFinancialSummary`, `getAssistantContext`, `finiaConfirmTransaction`) — `let` → `const` and unused variable cleanup.

### 📚 Documentation
- Updated `SECURITY_AUDIT_REPORT.md` with v0.2.0 permission findings and new-page authorization gaps.
- Updated `USER_MANUAL.md` with documentation for Goals, Messages, Savings Dashboard, Trips, and Waitlist Admin features.
- Updated `CHANGELOG.md` (this file).

### ⚠️ Known Issues (Carry-Over from v0.1.0)
- **CRITICAL**: jsPDF HTML injection vulnerability (GHSA-wfv2-pwc8-crg5) — `npm audit fix` not yet applied
- **HIGH**: Axios SSRF/prototype-pollution vulnerabilities — not yet updated
- **HIGH**: Authentication tokens stored in localStorage (architectural change required)
- **HIGH**: Trips page uses feature gate only, not RBAC permission gate — partial authorization gap
- **HIGH**: Messages page lacks explicit permission gate at load time
- **MEDIUM**: WaitlistAdmin authorization relies on client-side role string only
- xlsx library has outstanding prototype pollution vulnerability (awaiting upstream fix)
- Test coverage currently <30%

---

## [0.1.0] - 2026-06-01

### ⚠️ Security Updates (Documented — Not Yet Applied)
- **CRITICAL**: jsPDF HTML injection vulnerability identified (GHSA-wfv2-pwc8-crg5) — remediation pending
- **HIGH**: Axios SSRF + prototype pollution vulnerabilities identified — remediation pending
- **HIGH**: Multiple ReDoS vulnerabilities (flatted, lodash, minimatch, picomatch, rollup, socket.io-parser, vite) — remediation pending
- **Security Audit**: Comprehensive security audit completed (see SECURITY_AUDIT_REPORT.md)

### 📚 Documentation
- Added `SECURITY_AUDIT_REPORT.md` with comprehensive findings (19 dependency vulnerabilities + 13 code-level issues)
- Added `CHANGELOG.md`
- Created `USER_MANUAL.md` with feature documentation
- Added `SECURITY.md` with vulnerability disclosure policy

### 🔖 Version
- Updated version from 0.0.0 to 0.1.0
- Updated package name from `base44-app` to `flowfin`

### ⚠️ Known Issues in v0.1.0
- xlsx library has outstanding prototype pollution vulnerability (awaiting upstream fix)
- CSRF protection depends on Base44 SDK implementation (needs verification)
- Test coverage currently <30%
- All 19 dependency vulnerabilities remain pending `npm audit fix`

---

## [0.0.0] - 2026-05-19

### Initial Release
- Initial project setup with Base44 SDK
- React + Vite + Tailwind CSS configuration
- Base44 entities and agents setup
- Initial feature implementation: Dashboard, Transactions, Budget, AI Assistant (Finia), Family Management, Investments, Rentals, MSI, Reports, Scheduled Payments, Catalogs, Account Settings

---

## Security Advisories

| CVE | Package | Severity | Status |
|-----|---------|----------|--------|
| GHSA-wfv2-pwc8-crg5 | jsPDF | CRITICAL | ❌ Open |
| GHSA-pjwm-pj3p-43mv | Axios | HIGH | ❌ Open |
| GHSA-35jp-ww65-95wh | Axios | HIGH | ❌ Open |
| GHSA-25h7-pfq9-p65f | flatted | HIGH | ❌ Open |
| GHSA-r5fr-rjxr-66jc | lodash | HIGH | ❌ Open |
| GHSA-3ppc-4f35-3m26 | minimatch | HIGH | ❌ Open |
| GHSA-c2c7-rcm5-vvqj | picomatch | HIGH | ❌ Open |
| GHSA-mw96-cpmx-2vgc | rollup | HIGH | ❌ Open |
| GHSA-677m-j7p3-52f9 | socket.io-parser | HIGH | ❌ Open |
| GHSA-p9ff-h696-f583 | vite | HIGH | ❌ Open |
| GHSA-4r6h-8v6p-xvw6 | xlsx | HIGH | ❌ No fix available |
| GHSA-5pgg-2g8v-p4x9 | xlsx | HIGH | ❌ No fix available |

---

## Notes for Maintainers

- **Next action**: Run `npm audit fix && npm install jspdf@latest` to clear 17/19 dependency vulnerabilities
- Monitor xlsx library for fix at https://github.com/SheetJS/sheetjs
- Schedule next security audit for June 15, 2026
- Set up Dependabot for automated dependency updates
- Add `npm audit --audit-level=high` as a required CI step
- Implement RBAC permission gates on Trips and Messages pages (see SECURITY_AUDIT_REPORT.md)
