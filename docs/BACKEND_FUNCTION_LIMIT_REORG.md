# Backend Function Limit — Reorganization (FlowFin)

Base44 caps a project at **50 backend functions/endpoints**. FlowFin had **94**
deployed functions and was over the limit. This document records how the count
was brought into compliance.

## Key fact: nesting does NOT reduce the count

In Base44 a "function" is any directory containing an `entry.ts`/`entry.js`, and
its **name is its full path** (`functions/a/b/entry.ts` → function `a/b`). So
nesting functions in subfolders only reorganizes *names* — every `entry.ts` is
still one deployed endpoint. The only way to reduce the endpoint count is to
**consolidate** several functions behind a single dispatcher endpoint that routes
by an `action` field, and update every caller.

## Router pattern

Each router is one deployed endpoint (`functions/<router>/entry.ts`) that reads
`{ action, ...params }` and dispatches to a handler module under
`functions/<router>/handlers/<action>.ts`. Handler modules are **not** endpoints
(they have no `entry.ts`), so they don't count against the limit but are bundled
and deployed with the router.

Invocation contract changed from:

```js
base44.functions.invoke('getBudgetSuggestion', { familyId, months })
```
to:
```js
base44.functions.invoke('analytics', { action: 'getBudgetSuggestion', familyId, months })
```

The `action` key equals the **original function name**, so behavior is
unchanged — each handler is the original function body moved verbatim (only the
`Deno.serve` wrapper and the `await req.json()` read were adapted to the
dispatcher). All in-repo call sites (`src/` + one backend cross-call in
`validateMutationAllowed`) were updated in the same change.

## Consolidation map

| Router | Consolidated functions | Endpoints saved |
|---|---|---|
| `analytics` | getAverages, getBreakdownByCategory, getBreakdownByMerchant, getBreakdownByPaymentMethod, getBreakdownByPerson, getCategoryStats, getPeriodComparison, getPeriodTotals, getTimeSeries, getTopTransactions, detectAnomalies, detectRecurring, getBudgetSuggestion, getSavingsOpportunities, getSmartSuggestions, getPredictiveChips | −15 |
| `family` | approveMember, removeMember, selfJoin, createFamily, linkPersonToMember, getMyMembership, getFamilyBillingStatus, getFamilyLicenseInfo, findFamilyByCode, getMyFamily, verifyFamilyAccess | −10 |
| `session` | manageSession, sessionHeartbeat, trackActivity | −2 |
| `waitlist` | joinWaitlist, listWaitlist, markWaitlistInvited | −2 |
| `billing` | activateLicense, confirmLicensePayment, createPublicSnapshot, getPublicSnapshot | −3 |
| `payments` | linkTransactionToPayment, registerRentalPaymentSafe | −1 |
| `maintenance` | backfillModulePermissions, backfillPaymentFamilyId, backfillDefaultPerson, fixCategories, fixUserData, fixUserFamilyId, repairUserData, debugFiniaData, testAgentMultiFamilySupport, importExcelData, migrateViewOnlySince | −10 |
| `admin` | deleteAccount, sendTestEmails, getAssistantContext, validatePublishReadiness | −3 |

**Total: 94 → 48 endpoints.**

## Deliberately left untouched (invoked out-of-band)

These are **not** consolidated because they are called by channels outside this
repo's code, where renaming would silently break them. Renaming any of these
requires reconfiguring the caller (Base44 dashboard / external service):

- **Agent tools** (referenced by name in `base44/agents/finia.jsonc`):
  `finiaAnalyzeSpending`, `finiaConfirmTransaction`, `finiaDetectDuplicates`,
  `finiaGetAppGuide`, `finiaGetBudgetStatus`, `finiaGetCatalogs`,
  `finiaGetFinancialSummary`, `finiaGetSecureContext`, `finiaGetUpcomingPayments`,
  `finiaPrepareTransactionDraft`, `getWhatsAppContext`.
- **Webhook**: `mpWebhook` (Mercado Pago posts to its URL).
- **Mission Control bridge**: `acaciaControl` (ACACIA Mission Control HMAC channel).
- **Scheduled/cron** (configured in the Base44 dashboard by name):
  `autoPostScheduledPayments`, `checkAccountLifecycle`, `checkTrialExpiration`,
  `processMonthlyRenewal`, `dailyDocumentationAudit`, `dailyPermissionAudit`,
  `processTrialReactivationEmails`, `purgeExpiredConversations`,
  `queueBillingReminders`, `sendLifecycleEmails`, `deliverEmails`,
  `sendPendingEmailsNow`.
- **Entity-automation candidates** (payment-record → transaction):
  `createTransactionFromInvestmentPayment`, `createTransactionFromMSIPayment`,
  `createTransactionFromRentalPayment`, `createTransactionFromScheduledPaymentRecord`.
- **Family-sync (automation-suspect, kept to be safe)**: `syncUserFamily`,
  `syncUserFamilyForce`, `setUserFamilyId`.
- **Legacy agent functions (unverified external callers)**: `agentQuery`,
  `agentCreateTransaction`, `agentDeleteTransaction`, `agentGetCatalogs`,
  `agentUpdateTransaction`.
- **Others**: `scanReceipt`, `validateMutationAllowed`.

## Deploy checklist (must run outside this locked-down env)

The Base44 CLI is blocked from this environment (`403 host_not_allowed`), so
deploy from a machine with Base44 egress:

1. `npx base44 functions deploy --force` (the `--force` prunes the removed
   function names from the backend).
2. Verify the deployed count: `npx base44 functions list`.
3. No dashboard cron/webhook/agent reconfiguration is required — none of the
   consolidated functions were of those kinds.
