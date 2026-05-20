# Rollback Procedure — Zero-Friction Product Sprint

**Baseline branch**: `baseline/pre-zero-friction-2026-05-20` (protected ref on GitHub, points to `dd5346c08b12aaae6b03de7dd6c2522951ab4a39`)
**Baseline commit**: `dd5346c` (last merged PR #84 on `main`, as of 2026-05-20)
**Schema snapshot**: `docs/baseline/base44-schemas-2026-05-20.json`
**Feature branch**: `claude/zero-friction-product-Ekjja`

This document describes how to fully revert FlowFin to its pre-sprint state if the zero-friction product changes (Sprint 1: Quick Capture, viral invite, paywall stubs, analytics) cause unrecoverable issues in production.

> **Note on tag vs branch**: We chose a *branch* (`baseline/pre-zero-friction-2026-05-20`) instead of a git tag because the current managed-environment git proxy disallows tag pushes (HTTP 403). The branch is functionally equivalent for rollback purposes: it is a named immutable ref to commit `dd5346c`. **Do NOT push commits to this branch under any circumstances.** Treat it as read-only. If extra protection is desired, add branch protection rules in GitHub settings (Settings → Branches → Add rule → match `baseline/*` → "Restrict who can push").

---

## When to roll back

Trigger a rollback only when one or more of these are true:

- Captura de transacciones rota para >5% de usuarios activos durante >10 minutos.
- Paywall mostrado incorrectamente a usuarios con licencia `active` (riesgo de churn).
- Datos perdidos o corruptos (transactions, family memberships, etc.).
- Una vulnerabilidad de seguridad introducida que no se puede mitigar por patch rápido.

Si el problema es localizable a un solo flag, prefiera desactivar el flag antes de un rollback completo.

---

## Rollback options (escalating severity)

### Level 1 — Feature flag off (no redeploy needed if Vercel env var is hot-reload)

The Quick Capture flow is gated behind `VITE_QUICK_CAPTURE_ENABLED`. To disable:

1. In Vercel project settings, set environment variable:
   ```
   VITE_QUICK_CAPTURE_ENABLED=false
   ```
2. Trigger a redeploy of the latest production build (Vite env vars are inlined at build time, so a rebuild is required).
3. FAB will revert to navigating to `/Capture` (the original advanced form).
4. Estimated recovery time: ~3-5 minutes (Vercel rebuild + propagation).

### Level 2 — Revert merged PR(s)

If a specific PR introduced the regression, revert it via GitHub:

1. Identify the offending PR (e.g. PR #85, #86, etc. — they will be linked from the baseline PR).
2. `gh pr view <PR_NUMBER>` to inspect.
3. Create a revert PR: `gh pr create --base main --head revert/<PR_NUMBER>` or use the GitHub UI "Revert" button.
4. Merge the revert PR. Vercel auto-deploys from `main`.
5. Estimated recovery time: ~5-10 minutes.

### Level 3 — Full reset to baseline branch

Nuclear option — only if levels 1 and 2 don't suffice.

1. Verify the baseline branch exists on GitHub:
   ```bash
   git fetch origin baseline/pre-zero-friction-2026-05-20
   git rev-parse origin/baseline/pre-zero-friction-2026-05-20
   # Should print: dd5346c08b12aaae6b03de7dd6c2522951ab4a39
   ```
2. Create a rollback branch from the baseline:
   ```bash
   git checkout -b rollback/to-baseline-2026-05-20 origin/baseline/pre-zero-friction-2026-05-20
   git push -u origin rollback/to-baseline-2026-05-20
   ```
3. Open a PR `rollback/to-baseline-2026-05-20 → main` via GitHub UI or `gh pr create --base main --head rollback/to-baseline-2026-05-20`. **Do NOT force-push to main.** Resolve any conflicts by accepting the baseline version.
4. Merge the rollback PR. Vercel will auto-deploy main back to the baseline state.
5. Estimated recovery time: ~10-15 minutes.

---

## Base44 schema rollback

Base44 schema changes during the sprint are **purely additive** (verified via `update_entity_schema` semantics — fields not included in an update are removed from the schema definition, but existing documents retain their data). Therefore:

- **Default action: do nothing.** Old frontends that don't read the new fields will simply ignore them. Existing documents that lack the new fields will return `undefined` for those properties, which all consumers handle gracefully.
- **If you must remove the new fields** (e.g. they were causing query errors): re-fetch each affected entity's full schema via `mcp__43fcdc52...__list_entity_schemas`, **remove the new fields** from the JSON, and call `mcp__43fcdc52...__update_entity_schema` with the cleaned schema. **RLS is preserved automatically** if not included in the update payload (per MCP docs).
- **Do NOT use `docs/baseline/base44-schemas-2026-05-20.json` as a direct payload to `update_entity_schema`** — that snapshot omits RLS rules for brevity. Treat it as a reference only.

### Affected entities during Sprint 1

| Entity | Field added | Required? | Reversible? |
|---|---|---|---|
| `Family` | `default_person_id` (string) | No | Yes — purely additive |
| `FamilyMembership` | `invited_by_user_id` (string) | No | Yes — purely additive |

Neither change is required by any frontend code path; both are optional with frontend fallbacks.

---

## Post-rollback checklist

After any rollback:

- [ ] Verify production homepage loads.
- [ ] Verify `/Capture` form submits a transaction successfully.
- [ ] Verify `/Investments`, `/Reports`, `/Trips` render for an `active`-plan family.
- [ ] Verify `/LicenseAdmin` works for an ACACIA admin user.
- [ ] Verify `selfJoin` flow works with a known `join_code`.
- [ ] Notify users via email/banner if downtime exceeded 15 minutes.
- [ ] Open a post-mortem issue with: trigger, level used, recovery time, root cause, prevention.

---

## Re-deployment after rollback

Once root cause is identified and fixed:

1. Create a fresh branch from `main` (the rolled-back state).
2. Apply the fix.
3. Re-introduce the sprint changes incrementally with smaller, isolated PRs.
4. Tag a new baseline before each major change going forward.
