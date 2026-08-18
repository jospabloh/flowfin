# FlowFin — Project Notes

## `npm run build` must not mutate committed files (2026-08-08)

`scripts/sync-permission-snapshot.mjs` and `scripts/sync-docs-snapshot.mjs`
regenerate two git-tracked files consumed only by the Base44 backend
(`base44/functions/dailyPermissionAudit/permissionManifests.ts`,
`base44/functions/dailyDocumentationAudit/versionHistorySnapshot.ts`) — never
by the frontend. Both scripts embed a `// Last synced: <today>` stamp, and
the docs one also embeds a `git log` snapshot, so re-running them changes the
file even when nothing meaningful did.

`build` used to run both scripts before `vite build`. Since the frontend
never reads their output, that only ever produced local, uncommitted diffs
on two files that also get regenerated (and legitimately committed) by
`npm run release`. Any routine/repeated `npm run build` — including from
external deploy tooling that does `git pull` → build → deploy — left those
two files dirty locally, so the *next* `git pull` for this repo aborted with
"Los cambios locales de los siguientes archivos serán sobrescritos al
fusionar" the moment `main` had a newer copy of either file (e.g. from
someone else's `npm run release`). CI never caught this because `ci.yml`
never runs `npm run build` at all — it calls `permissions:check` and
`validate:rls` directly.

**Fix:** `build` now only runs `permissions-check.mjs` (validation, not
generation) + `vite build`. The two sync scripts still exist and still run
via `npm run release` and `npm run sync:snapshots` — run one of those by hand
when you actually want to refresh the two generated files, then commit the
result. Don't wire snapshot regeneration back into `build`; if a routine
build needs to mutate a tracked file to stay "fresh," that file will keep
producing exactly this class of pull conflict.

## Finia chat "smart cards" — structured field parsing, not prose guessing (2026-08-04)

Finia's chat replies (`src/pages/Assistant.jsx` + `src/components/finia/`) are
free text from a Base44 agent (`base44/agents/finia.jsonc`) — there is no
structured payload the frontend can read from the conversation stream, only
`message.content` markdown. Two concrete bugs came from treating that text as
if it were reliable:

1. **Draft/duplicate tables rendered as garbled pipe soup.** `react-markdown`
   v9 only implements CommonMark by default — pipe-table syntax is a GFM
   extension. Without `remark-gfm`, consecutive table-row lines (no blank
   line between them) get merged by the CommonMark paragraph rule into one
   run-on paragraph, so a transaction-draft table showed up as
   `| 💰 **Monto** | $104.50 | | ✉️ **Tipo** | Gasto | ...` on one line
   instead of a table. Fixed by adding `remark-gfm` and passing it via
   `remarkPlugins` everywhere `ReactMarkdown` renders Finia's replies.
2. **Quick-reply chips picked the wrong intent.** `FiniaQuickChips`' old
   `detectIntent` ran regexes like `/de quién|de quien/` against the whole
   last assistant message. When Finia listed **all** the fields it still
   needed (`**Monto** (¿cuánto?)`, `**Persona** (¿de quién fue?)`, ...), that
   regex matched on the `Persona` bullet alone and showed person-name chips
   instead of nothing useful — a six-field checklist got read as one
   yes/no question.

**Fix:** `src/lib/finiaCardParser.js` extracts a `{ field: value }` map from
known field labels (Monto, Tipo, Concepto, Rubro, Subrubro, Persona, Forma de
pago, Fecha) regardless of whether Finia formatted them as a bullet list or a
markdown table, and only treats a message as a real transaction-draft/
duplicate-warning moment once enough fields are actually present with values
(not just mentioned). `FiniaMessageBubble` renders those moments as real
interactive cards (`components/finia/cards/`) with Confirm/Cancel/Edit
buttons instead of a plain colored bubble; `FiniaQuickChips` reuses the same
parser so the chips shown never disagree with the card shown. If you touch
`finia.jsonc`'s draft/duplicate reply format, update the label patterns in
`finiaCardParser.js` — do not add more raw-substring checks against
`message.content` elsewhere, that's exactly what broke.

## License lifecycle is owned by Mission Control (2026-08-03)

FlowFin has **no native license-lifecycle automation**. `checkAccountLifecycle`,
`checkTrialExpiration`, `processMonthlyRenewal`, `queueBillingReminders`,
`processTrialReactivationEmails`, `sendLifecycleEmails`, and `deliverEmails`
were removed — Mission Control's `api/cron/license-lifecycle.js`
(`runUnifiedLifecycleForApp`) already ran the same trial/active/view_only/
suspended transitions and reminder emails against `Family.billing_status` in
parallel, an unreviewed duplicate-authority risk the platform owner ruled
out. Do not re-add a FlowFin-native cron for license status transitions or
lifecycle reminder emails — that logic belongs in Mission Control now.

Confirmed before removal: none of the seven had a caller in `src/` or in any
other `entry.ts` except each other (`checkTrialExpiration` → `checkAccountLifecycle`,
both removed together). `acaciaControl` (Mission Control's HMAC write bridge)
and the manual `confirmLicensePayment` flow reference none of them — kept
untouched. Deploying this change requires `npx base44 functions deploy
--app-id 69b97ea9c9a713486b5a01fd --force` (committing alone does not remove
the deployed functions or any cron schedule already registered in the Base44
dashboard — check the scheduler panel too).

## Base44 — las funciones NO se auto-deployan desde GitHub

**Mergear un PR a `main` NO deploya las funciones de Base44.** Al mergear se
rebuildea/redeploya solo el **sitio** (frontend). Las funciones bajo
`base44/functions/` se deployan **aparte y a mano** con la CLI de Base44.

Tras cualquier cambio en `base44/functions/` (agregar, borrar, renombrar o
editar una función) hay que correr, desde una máquina con salida a Base44:

```
git pull origin main                                   # nunca deployar un checkout viejo
npx base44 functions deploy --app-id <APP_ID> --force  # --force poda las funciones ya removidas
npx base44 functions list  --app-id <APP_ID>           # verificar: total ≤ 50
```

App id de FlowFin: `69b97ea9c9a713486b5a01fd`.

Si no se corre el deploy, el frontend redeployado llama endpoints que no existen
en el backend → **404** → los reportes/acciones salen vacíos (mismo síntoma del
outage 2026-07-02: los routers `analytics`/`family`/… no estaban deployados y los
reportes no mostraban datos).

> Detalle completo del patrón de routers y la recuperación del cap de 50
> funciones en `docs/BACKEND_FUNCTION_LIMIT_REORG.md`.

### ⚠️ Antes de deployar: `CRON_SECRET` tiene que existir (2026-08-05)

`_internalGuard.ts` es **fail-closed**: si `CRON_SECRET` no está configurado
en los secrets de Base44, el guard devuelve `403` y **desactiva por completo**
las funciones que lo usan — hoy `dailyDocumentationAudit`,
`dailyPermissionAudit` y `purgeExpiredConversations`.

Antes era fail-open justamente para que deployar no pudiera romper un
scheduler ya andando. Ese seguro ya no existe: lo cambió `fa11358`, un push
directo a `main` de `base44-builder[bot]` (sin PR, sin review — el mismo
patrón del incidente de RLS del 2026-06-29). **Deployar sin el secreto puesto
apaga los tres crons en silencio**, incluidos los dos crons de auditoría que
justamente existen para avisar de este tipo de regresión. Ningún chequeo de
CI lo detecta: sólo se ve en runtime, como crons que dejan de reportar.

Orden correcto:

1. Verificar/crear `CRON_SECRET` en el panel de secrets de Base44.
2. Agregar el header `x-cron-secret` a la configuración de cada automation
   (si no, el scheduler queda fuera aunque el secreto exista).
3. Recién ahí correr `npx base44 functions deploy ... --force`.
4. Confirmar en el panel de scheduler que los tres jobs siguen corriendo.

Cada función que usa el guard tiene su **propia copia colocada** de
`_internalGuard.ts` (no hay un módulo compartido: la copia suelta en la raíz
de `base44/functions/` era código muerto y se eliminó en 2.21.0). Si cambiás
la semántica del guard, cambiala en **todas** las copias o quedan divergentes.

## Base44 — cambios de RLS en `base44/entities/*.jsonc` pueden romper producción en silencio

El 2026-06-29, un commit automático de `base44-builder[bot]` ("Apply RLS
security recommendations") se pusheó **directo a `main`, sin PR ni review**,
y le quitó a ~20 entidades (Transaction, Category, Person, PaymentMethod,
Family, FamilyMembership, etc.) la cláusula que permite a un miembro de
familia (no-admin) leer sus propios datos — dejando el `read` limitado
solo a platform-admin. El resultado: todo usuario no-admin de cualquier
familia se quedó sin poder ver su propio historial financiero, y el flujo
de onboarding lo mandaba en loop a "unirse a una familia" aunque ya
perteneciera a una. Nadie lo notó por **9 días**, hasta que una usuaria
reportó el síntoma (ver PRs #173 y #174).

El chequeo estático que ya existía (`npm run validate:rls` /
`scripts/validate-rls.mjs`) no lo detectó porque el RLS resultante era
sintácticamente válido — solo le faltaba lógica de negocio (el bug no es
"regla mal escrita", es "regla demasiado restrictiva").

**Mitigación agregada:** `validate-rls.mjs` ahora también falla si una
entidad con campo `family_id` o `admin_user_id` tiene su regla `read`
reducida a solo platform-admin, sin ningún camino alterno para que el
dueño/miembro de esa familia la lea. Corre en cada push/PR (incluyendo
pushes directos de bots a `main`), así que un cambio de este tipo falla
CI en minutos en vez de quedar sin detectar por días.

**Si tocas `base44/entities/*.jsonc` (a mano o vía una recomendación de
Base44):**
1. Corré `npm run validate:rls` localmente antes de pushear.
2. Si el bot de Base44 pushea directo a `main` con un RLS más restrictivo,
   no asumas que está bien solo porque no rompe la sintaxis — verificá que
   los miembros de familia (no solo el admin) sigan pudiendo leer/escribir
   lo que necesitan.
3. Si necesitás que una entidad sea legítimamente admin-only pese a tener
   `family_id`, agregala a `ADMIN_ONLY_READ_ALLOWLIST` en
   `validate-rls.mjs` con una razón — no borres el chequeo.

## Self-service data export (added 2026-08-18)

A portfolio-standard audit (`jospabloh/acacia-app-standard`, module 7 —
cuenta y zona de peligro) found `AccountSettings.jsx` had a full
delete-account danger-zone flow but no way for a user to download their own
data first — `Reports.jsx`'s "export" only produces PDF/PNG chart images,
not raw data. New `exportFamilyData` handler
(`base44/functions/admin/handlers/exportFamilyData.ts`) runs on the caller's
own client (not `asServiceRole`, same as `deleteAccount.ts`'s own pattern —
RLS itself does the family scoping) and returns every row the family owns
across `Transaction`, `Category`, `Subcategory`, `CategoryBudget`, `Person`,
`PaymentMethod`, `Goal`, `Investment`, `InvestmentPayment`, `MSI`,
`MSIPayment`, `RentalProperty`, `RentalPayment`, `ScheduledPayment`,
`ScheduledPaymentRecord`, `Trip` as one JSON payload; a failure on any single
entity doesn't fail the whole export. `AccountSettings.jsx` turns the
response into a client-side download (`Blob` + a throwaway `<a download>`,
no server-side file storage needed), gated on `account.profile.view`'s
`can_read` (the same "can see your own account data" permission the rest of
the page already reads, not the narrower `account.profile.delete`).

Note: `Login.jsx` does **not** need billing-status awareness — billing
status is a per-family concept only known after authentication, and the app
already surfaces it globally post-login via `TrialBanner.jsx`
(`Layout.jsx`) and `DowngradeNotice.jsx` (`App.jsx`), both of which already
handle `view_only`/`suspended` with upgrade/support links. An earlier
audit pass flagged this as a gap before checking for that; it isn't one.

## Read-only billing gate: AI-assistant gap fixed 2026-08-18, direct-entity-write gap closed 2026-08-18 (same day, follow-up pass)

`validateMutationAllowed`/`_agentGuard.ts`'s `assertBillingAllowed` exist to
block writes once a family's `billing_status` is `view_only`/`suspended`,
but neither was actually wired everywhere a write can originate:

- **Fixed:** `agentCreateTransaction`, `agentUpdateTransaction`,
  `agentDeleteTransaction` (the Finia AI-assistant transaction tools) had
  **no billing check at all** — Finia could create/edit/delete transactions
  for a suspended family with zero gate, even though `_agentGuard.ts`'s
  `assertBillingAllowed` exists precisely for this. Each of the three now
  has its own inlined copy (matching the file's existing "no local imports
  in Deno deploy" convention — see `resolveFamily`/`assertRefInFamily`,
  already duplicated the same way) that checks `Family.billing_status` via
  `asServiceRole` before any write, mirroring `_agentGuard.ts`'s own logic.
- **Fixed (follow-up pass, same day):** the web UI's own direct
  `base44.entities.Transaction/Category/.../create/update/delete()` calls —
  ~80 call sites across 18 files in `src/hooks/`, `src/pages/`,
  `src/components/` (`Catalogs.jsx`, `Transactions.jsx`, `Capture.jsx`, and
  more) — now go through **`base44/functions/guardedEntityWrite`**, a new
  Safe function covering the 16 family-scoped entities those call sites
  write: `Transaction`, `Category`, `Subcategory`, `Person`,
  `PaymentMethod`, `CategoryBudget`, `Goal`, `Investment`,
  `InvestmentPayment`, `MSI`, `MSIPayment`, `RentalProperty`,
  `RentalPayment`, `ScheduledPayment`, `ScheduledPaymentRecord`, `Trip`.
  `src/lib/guardedWrite.js` is the client-side wrapper
  (`guardedCreate`/`guardedUpdate`/`guardedDelete`) every migrated call site
  now uses instead of `base44.entities.X.*` directly — same calling shape
  (data in, record out via axios's `.data`), so each migration was a
  near-mechanical swap. `useCreateTransaction.js`'s pre-existing client-side
  `isReadOnly` check (added earlier the same day) is now a fast first-line
  check backed by the same real server-side gate everywhere else, not the
  only thing standing between a read-only family and a write.

  **What `guardedEntityWrite` actually checks**, for any non-platform-owner
  caller (platform owner — `user.role === 'admin'` — bypasses both, same as
  every other privileged path in this app):
  1. **Tenant match.** The caller's family is always re-derived from their
     own approved `FamilyMembership` — never trusted from the request. For
     `create`, the resolved family is force-set onto the record regardless
     of what the client sent; for `update`/`delete`, the *existing* record's
     `family_id` is what's checked against the caller's family (a client
     can't submit a foreign id to sidestep this), and a client-submitted
     `family_id` in an update patch is always stripped before the write.
  2. **`RolePermission` + `DEFAULT_MATRIX`**, for entities that have a
     defined permission key (all except `CategoryBudget` — see below) —
     mirrors `usePermission.js`'s own three-layer resolution
     (platform-admin → DB row → client default). The entity→key mapping and
     the "member" role's default `PermRow` per key are duplicated inline in
     `guardedEntityWrite/logic.ts` (Deno can't import across function
     directories, and can't import from `src/` at all — same constraint
     `_agentGuard.ts` already documents), sourced directly from each
     module's `src/**/permissions.js` manifest. **Keys are checked at
     SECTION granularity** (e.g. `catalog.categories`, not the leaf
     `catalog.categories.create`) even though a few client call sites check
     a leaf key for their own UI gating — every manifest's leaf-level
     default is identical to its parent section's default, so this produces
     the same effective permission in every case *except* if an admin ever
     sets a `RolePermission` override at a leaf key without also setting one
     at the section key, which `guardedEntityWrite` wouldn't see. Accepted
     precision trade-off, not attempted to close further in this pass.
  3. **Billing read-only status** (`view_only`/`suspended`), same as the
     AI-assistant fix above.
  - **`CategoryBudget` has no permission key at all** — `budget.permissions.js`
    only defines a `view` section, no create/edit/delete action exists in
    the permission system for it (confirmed: no page checks `usePermission`
    before writing it either). `guardedEntityWrite` still applies the
    tenant + billing gates to it, but doesn't newly restrict who can write
    it — preserves current behavior exactly (any family member already
    could, and still can).
  - Unlike some other apps in this portfolio, none of these 16 entities has
    an RLS-level carve-out that grants a non-admin role write access beyond
    what `RolePermission`/`DEFAULT_MATRIX` already model (e.g. LIUMA's
    parent/`ChargeItem` exception) — every one maps to `admin`/`member`
    cleanly, so `guardedEntityWrite` didn't need an entity-specific carve-out.
  - **`registerRentalPaymentSafe`** (an existing Safe function, already
    server-mediated — not one of the ~80 direct-write call sites) was found
    to have neither gate either, in the same area of the codebase. Given it
    already resolves `familyId`/`membership` for its own tenant check, it
    got the same two checks added inline (permission key `'rental.payments'`,
    capability `create`→`can_write`; billing read-only) rather than left as
    an obviously-related loose end right next to this fix.

**Verification performed:** `npm run lint`, `npm run build` (incl.
`permissions-check.mjs`), `npm run validate:rls` all pass — 0 new
`permissions:check` orphans/missing introduced (the check only scans
`usePermission()` call sites in `src/`, unaffected by the new backend
function). `npm run typecheck` was already failing on `origin/main` before this PR (443
pre-existing errors — this repo's typecheck has never been clean and is not
part of CI, which only runs `permissions:check`/`validate:rls`/
`deno lint`/`deno test`); confirmed by diffing error output before/after
that this PR introduces zero *new* errors (426 after — fewer, not more; the
same pre-existing `ScheduledPayments.jsx` errors just shifted a couple of
lines and are now attributed to `guardedCreate`/`guardedUpdate` call sites
instead of `base44.entities.X.*` ones). `deno` isn't available in this sandbox — the new
`guardedEntityWrite/logic.ts` + `logic.test.ts` (a real Deno unit-test file,
same pattern as `_agentGuard.test.ts`) get their first live `deno
lint`/`deno test` in this PR's CI, same limitation as the earlier
AI-assistant fix. **Not verified:** an actual browser session as a
permission-restricted family member or a suspended family (not achievable in
this environment) — risk is bounded the same way as every other module-3
fix in this portfolio: every migrated call site preserves identical behavior
for anyone whose role/permission combination already granted access: only a
user an admin explicitly denied, or a family in a read-only billing state,
now correctly gets rejected server-side instead of the write silently
succeeding.
