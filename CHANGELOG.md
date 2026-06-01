# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
