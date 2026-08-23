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

## Base44 — mergear a `main` no deploya NADA, ni funciones ni sitio

**Mergear un PR a `main` NO deploya las funciones de Base44** — eso ya estaba
documentado. Lo que este archivo afirmaba de más es que *el sitio* sí se
redeployaba al mergear. **No es cierto: mergear no deploya nada.**

Evidencia (2026-08-21): el fix del tutorial se mergeó en el PR #213 y llegó a
`main` como `5922916` a las 17:14 UTC. **Cuatro horas después**, el árbol de
trabajo del app en Base44 seguía sirviendo `src/hooks/useTutorialState.js` con
**352 líneas y cero rastros del fix** — el `enqueuePersist` con el
`workerPromiseRef` que provoca la carrera seguía ahí, tal cual. Es una ventana
corta sólo porque se fue a comprobar; nada indica que fuera a cerrarse sola, y
un fix que se merge un viernes se queda así hasta que alguien lo note.

El caso realmente caro de esta misma clase fue el backend, no el frontend:
`guardedEntityWrite` estuvo en `main` desde el 2026-08-18 con
`src/lib/guardedWrite.js` y sus 19 llamadores ya sirviéndose en el app,
llamando a una función que no existía en el backend — **tres días de 404 en los
writes principales**, cerrados con el deploy del 2026-08-21.

Detalle que engaña: el checkpoint del app reporta `git_commit_hash` igual al
HEAD de `main` en GitHub. **Ese hash no prueba que el código servido sea ese.**
Base44 espeja los commits en su metadata, pero lo que se buildea y se sirve es
el árbol de trabajo del app, y los dos pueden estar desalineados. Comprueba
contenido, no hashes:

```bash
# desde el MCP de Base44, o abriendo el archivo en el panel del app
wc -l src/hooks/<archivo-que-cambiaste>
grep -c "<identificador que SOLO existe en el fix>" src/<archivo>
```

Tras mergear cualquier cambio de frontend, **corre el deploy del sitio a mano**
igual que ya se hace con las funciones:

```
git pull origin main
npx base44 site deploy --app-id 69b97ea9c9a713486b5a01fd
```

Las funciones bajo `base44/functions/` se deployan **aparte** con la CLI (ver
abajo). Ninguno de los dos pasos ocurre solo.

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

**Re-flagged again in the 2026-08-18 portfolio audit** (same claim,
independently re-derived from code rather than from this file — that audit's
own stated methodology is "evidence from code, not from what each CLAUDE.md
documents," so re-flagging isn't itself a mistake). Re-verified: `grep` on
`billingStatus === 'view_only' || billingStatus === 'suspended'` in
`TrialBanner.jsx` confirms both statuses are still handled exactly where
this note says. The architectural reason still holds — a login screen shown
to an unauthenticated visitor cannot know which family (if any) they belong
to, so it structurally cannot carry a billing-status banner; the correct
place for that state is the very first authenticated screen, which is
already where it lives. Closing this out as verified-not-a-gap rather than
building a login-screen state that has nothing to key off of.

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

## El tutorial reaparecía después de "Omitir" (fixed 2026-08-21)

Reportado en producción por Mochi Family: el admin pulsaba **"Omitir el
tutorial por completo"** una y otra vez y el tutorial volvía a abrirse en cada
sesión. `handleSkip` en `TutorialController.jsx` estaba bien escrito —
escribía el flag local, cerraba el overlay y llamaba a `markSkipped` — así que
el bug no estaba a la vista en el controlador.

**Evidencia (leída de la app en vivo, no inferida):** la membresía del admin
(`69b9a0aee2f1661c23b14f63`) tenía `tutorial_state.status: "in_progress"` con
`updated_at: 2026-04-19`, mientras que el `updated_date` de la fila era de ese
mismo día. Es decir: la fila **sí** se escribía, pero el estado terminal
`skipped` nunca llegaba a ella.

**Causa raíz: `enqueuePersist` podía tirar un estado a la basura en silencio.**
El worker se arrancaba sólo si `workerPromiseRef.current` era null, pero esa ref
sigue siendo no-nula durante el microtask que va desde que `drainPersistQueue`
sale de su `while` hasta que su `.finally()` la limpia. Un `enqueuePersist` que
cayera en esa ventana escribía `pendingStateRef` y **no arrancaba worker**,
mientras el worker vivo ya había salido del bucle: nadie vaciaba la cola. Para
un estado no terminal daba igual (el siguiente paso lo reintentaba), pero el
write de `skipped` llega justo después del persist del paso actual — que es
exactamente cuando esa ventana está abierta.

**Arreglo, en tres capas, para que "omitir" no dependa de que la red coopere:**

1. **La cola ya no pierde nada.** `enqueuePersist` arranca worker según
   `isPersistingRef` (que sí refleja "hay alguien vaciando ahora"), y
   `drainPersistQueue` vuelve a vaciar al final si algo entró mientras se
   apagaba.
2. **Un estado terminal se reintenta.** El `catch` seguía sin re-encolar por
   diseño (evitar el loop de PUTs que este archivo ya documenta). Ahora
   distingue: un `in_progress`/`postponed` perdido no importa; un
   `skipped`/`completed` perdido significa que el usuario vuelve a ver el
   tutorial, así que se re-encola una vez, y si vuelve a fallar queda para el
   self-heal del próximo arranque.
3. **Terminal es una puerta de un solo sentido.** `applyTutorialUpdate` ahora
   rechaza cualquier update **no** terminal cuando el flag local ya dice
   "omitido/completado". Sin esto, cualquier `setCurrentStep`/`startOrResume`
   tardío o en vuelo — y hay varios, porque los efectos de paso corren en
   render — podía devolver el registro a `in_progress` y el tutorial reabría
   como si nunca lo hubieran cerrado. `markSkipped`/`markCompleted` además
   escriben el flag local ellos mismos, para que la garantía no dependa de que
   cada call site se acuerde de hacerlo.

`restartFromBeginning` (el "volver a ver el tutorial" desde Mi Familia) es la
única salida: limpia el flag y pasa `allowAfterTerminal`.

**"Para luego" sigue siendo temporal a propósito** — `markPostponed` no es
terminal y el tutorial vuelve en la siguiente sesión, que es el comportamiento
pedido. La "X" de la cabecera comparte esa semántica (ver el comentario en
`TutorialController.jsx`), no la de "Omitir".

**Dato en vivo corregido:** la membresía de Mochi Family se puso a
`status: "skipped"` vía el MCP de Base44, así que el tutorial deja de salir ya
mismo sin esperar al deploy. Cualquier otra familia atrapada por el mismo bug
se detecta con `tutorial_state.status: "in_progress"` y un `updated_at` viejo.

**Verificado:** `npm run lint`, `npm run validate:rls` (36 entidades) y
`npm run build` pasan. Este repo no tiene runner de tests de frontend, así que
no hay test de regresión: el arreglo es en `src/hooks/useTutorialState.js`
únicamente (ningún cambio en `base44/`, así que no requiere deploy de
funciones).

**Corrección 2026-08-21 — el mergeo no bastó.** La versión anterior de este
párrafo daba por hecho "el redeploy del sitio que ya ocurre al mergear". No
ocurre (ver "Base44 — mergear a `main` no deploya NADA" arriba): cuatro horas
después del merge, el app seguía sirviendo el archivo sin el fix. Se corrigió
escribiendo el archivo directo en el app — verificado
byte a byte contra `main` (`md5sum` idéntico), `eslint` limpio y `npm run build`
en verde dentro del propio sandbox del app. **Un fix de frontend no está
entregado hasta que `npx base44 site deploy` corre y el archivo servido lo
tiene.**

## Deploy: el id de la app vive en el repo (módulo 11, 2026-08-21)

El 2026-08-21, un `git pull` fallido dejó la terminal parada en `flowfin` y los
seis comandos siguientes desplegaron **el backend de FlowFin** en puntos, radar,
stockflow y ctrlhq: la CLI toma el origen del **directorio actual** y el destino
de `--app-id`, y nada comprueba que coincidan. En radar el `entities push` llegó
a completarse y borró el modelo de datos entero. Detalle en
`jospabloh/acacia-app-standard` → `docs/incidents.md`.

Por eso este repo ya no se deploya a mano:

```bash
npm run deploy            # funciones — lee el appId de base44.app.json
npm run deploy:site       # frontend — mergear a main NO lo hace por ti
npm run deploy:entities   # schema — DESTRUCTIVO, pide escribir "FlowFin"
npm run functions:audit   # quién llama a cada endpoint
```

**Mergear a `main` no deploya el sitio.** Se creyó lo contrario durante meses.
Se comprobó al revés arriba: un fix mergeado a `main` seguía sin servirse cuatro
horas después, y la misma clase de fallo en el backend costó tres días de 404 en
los writes principales. El
frontend se deploya a mano con `npm run deploy:site`, igual que las funciones.
Y comprueba el resultado por **contenido**, no por hashes: el checkpoint del app
puede reportar un `git_commit_hash` igual al HEAD de `main` mientras el árbol que
de verdad se sirve está atrasado.

`scripts/base44-deploy.mjs` **rechaza** un `--app-id` por argumento, así que el
directorio y la app destino no pueden desalinearse. `deploy:entities` imprime la
lista de entidades y el nombre de la app antes de pedir confirmación — ver
"36 entidades de FlowFin" mientras crees estar desplegando otra app es la señal
de alto que faltaba.

`npm run validate:functions` (dentro de `npm run lint`) falla si los endpoints
pasan de `maxFunctions` en `base44.app.json` — hoy **45**, con
Base44 cortando en 50. El margen importa: por encima del tope el deploy falla a
media aplicación y la CLI **no** llega a su fase de poda, así que las funciones
viejas siguen ocupando los slots que harían falta para arreglarlo.

**Se borraron dos endpoints fantasma** que ocupaban slot sin ser endpoints:
`_internalGuard/entry.ts` (sin `Deno.serve`, byte a byte idéntico a las tres
copias colocadas que sí se importan) y `_txAggregateHelper/entry.ts` (4 líneas
que se autodescriben *"intentionally a no-op placeholder"* y devuelven 404;
el módulo real de 421 líneas vive en `analytics/_txAggregateHelper.ts`). 47 → 45.

**Antes de consolidar o borrar cualquier función, corre `npm run functions:audit`.**
Una función sin llamadores en el repo casi nunca está muerta: el llamador vive
fuera, donde grep no ve — un entity hook de Base44, un cron del panel, un
`tool_config` de un agente, la URL de un webhook. El audit marca esas como
`REVISAR EN PANEL` en vez de adivinar; confírmalas contra
`npx base44 functions list` (anota `(N automation)`) antes de tocarlas.

## Selector de tema: claro / oscuro / dispositivo (módulo 12, 2026-08-21)

El tema se elige desde **un solo control**: un círculo pequeño anclado a una
esquina de la pantalla que muestra el modo vigente y, al pulsarlo, crece de lado
en una pista de tres ranuras (Claro · Oscuro · Sistema) con un indicador que se
desliza a la elegida. Tres estados, tres posiciones físicas — que es justo lo
que un botón sol/luna de dos estados no puede expresar en cuanto "seguir al
dispositivo" entra en la lista.

Lo que se guarda es la **preferencia** (`light` | `dark` | `system`), nunca el
color resuelto: con `system` la app sigue a `prefers-color-scheme` en vivo, sin
recargar. `index.html` trae un script pre-montaje que resuelve y aplica el tema
antes de que monte React, así que el primer frame ya sale del color correcto;
ese script y el proveedor comparten clave y valores, y cada uno lleva un
comentario apuntando al otro.

`src/components/ThemeSwitcher.jsx` es **idéntico byte a byte en todas las apps
del portafolio**. La fuente canónica vive en `jospabloh/acacia-app-standard` →
`shared/theme/`: cámbialo allí y cópialo, no lo edites aquí. Lo único propio de
esta app es `src/lib/useThemeMode.js` (de dónde sale el estado) y las variables
`--theme-switcher-bottom/right` en `src/index.css` (dónde se coloca).

Se quitaron los toggles de la barra lateral, del drawer móvil y de `Dashboard`;
la paleta de comandos conserva **tres** comandos (uno por modo) porque son un
atajo de teclado al mismo estado, no un segundo escritor del tema. El control
sube por encima de la barra inferior en móvil (`max-width: 767px`).

## `npm run test:smoke` — comprueba el sitio DESPLEGADO (2026-08-22)

`tests/smoke/smoke.spec.js` es la suite compartida del portafolio, idéntica byte
a byte en todos los repos; la fuente canónica está en
`jospabloh/acacia-app-standard` → `shared/smoke/`. Lo propio de esta app vive en
`tests/smoke/smoke.config.js` (URL, `<title>`, cómo representa el tema).

**No comprueba el build local: comprueba lo que se sirve.** Es la automatización
de la regla que cada CLAUDE.md repite — mergear no deploya nada, y hay que
verificar por contenido y no por hash. Afirma cuatro cosas, todas derivadas de
lo que el propio repo produce (nunca de copy adivinado, que se rompe al cambiar
una palabra y enseña a ignorar la suite):

1. responde 200 y el `<title>` es el de esta app — no un deploy viejo ni otro;
2. no lanza excepciones al pintar;
3. el tema llega resuelto desde el primer frame (el script pre-montaje viajó);
4. el selector de esquina está montado, cambia el tema y la preferencia
   sobrevive a un reload.

**No corre en el pipeline normal ni desde un sandbox de desarrollo**: la salida
HTTPS ahí va por un proxy con allowlist que no incluye estos dominios. Corre en
GitHub Actions (`.github/workflows/smoke.yml`): `workflow_dispatch` para
dispararla a mano justo después de un deploy, y un cron diario como red.

    npm run test:smoke                      # contra producción
    SMOKE_URL=https://… npm run test:smoke  # contra un preview

Desde el 2026-08-22 la suite añade una quinta afirmación, del **módulo 12**: el
selector no tapa nada y nada lo tapa, en móvil (390), tablet (834) y escritorio
(1440), plegado y desplegado. Un control anclado por encima de todo en una
esquina es justo lo que acaba sentado sobre una barra inferior o un botón
flotante, y entonces la app pierde una función al ancho que nadie abrió. La
comprobación distingue las dos direcciones — algo pintado encima del selector, y
el selector respondiendo por un control que hay debajo — y nombra el control
afectado. Se coloca con `--theme-switcher-bottom/right`; si otra cosa ya es dueña
de esa esquina, se mueve el selector, no el control.

## Módulo 14 — auditoría de aislamiento multi-tenant (2026-08-22)

Nuevo en `jospabloh/acacia-app-standard`. **No es releer las reglas de RLS** (eso
es el módulo 4): es recorrer, con fecha y por escrito, todo lo que puede cruzar
un inquilino con otro — cada entidad, cada función de backend (el inquilino se
re-deriva en el servidor, nunca del cuerpo de la petición, y en update/delete se
comprueba contra el registro **almacenado**), cada campo bloqueado, cada
exportación/reporte/búsqueda, cada destinatario de correo o webhook, y el cambio
de inquilino. Contra el **esquema desplegado**, no contra el archivo del repo.

Se repite cuando se añade una entidad, una función o un rol. El resultado se
anota aquí, incluyendo **lo que no se pudo verificar** desde el entorno de
trabajo — normalmente una sesión autenticada como usuario restringido de un
segundo inquilino. Decirlo vale más que insinuar una cobertura que no se logró.

Lo que motiva el módulo es que todos los fallos de aislamiento que este
portafolio llegó a desplegar eran **sintácticamente válidos**: la rama de rol sin
`$and` al inquilino en `Parish` de cateqhub, las 84 instancias de liuma donde el
motor descartaba la cláusula hermana de `user_condition`, los campos de licencia
escribibles por el propio inquilino en puntos y rumbo, y el `PermissionProfile`
que ningún RLS puede consultar porque vive en otra fila.

### Resultado — 2026-08-23, contra el esquema desplegado

Contra `list_entity_schemas` (appId `69b97ea9c9a713486b5a01fd`), no contra los
`.jsonc`, más los 47 grupos de funciones. **FlowFin es la app con más datos
reales del portafolio** —6 familias, cientos de transacciones— así que aquí
"latente" casi nunca aplica.

**Las funciones son las mejores del portafolio.** No encontré en ellas ninguna
lectura ni escritura cruzada. El problema está una capa más abajo, en la RLS de
entidad, y en un campo que esta app —única entre sus hermanas— nunca declaró.

#### 1. El campo del que cuelga todo el aislamiento no tiene candado

Cada entidad operativa se llavea **sólo** a `{{user.data.family_id}}`. Ejemplo
literal del esquema desplegado de `Transaction`, y las cuatro operaciones son
iguales:

```json
"read": {"$or":[
  {"user_condition":{"role":"admin"}},
  {"data.family_id":"{{user.data.family_id}}"},
  {"data.family_id":"{{user.data.data.family_id}}"}
]}
```

Ahora la parte incómoda. En el esquema desplegado, `User` declara **dos**
propiedades —`role` y `preferences`— y **ni una sola regla `rls.write` a nivel de
campo**. Su regla de entidad es
`"update": {"$or":[{"user_condition":{"role":"admin"}},{"id":"{{user.id}}"}]}`:
cada quien puede escribir su propia fila. Y `family_id` **no está declarado**:
vive suelto en la bolsa `data`.

Compárese con las hermanas. stockflow, puntos y ctrlhq **sí declaran**
`business_id` en `User`, y lo declaran precisamente para poder colgarle
`rls.write: {"user_condition":{"role":"admin"}}`. FlowFin no declaró el campo, y
por tanto no tiene dónde poner el candado.

Si un usuario puede escribir su propio `data.family_id`, entonces por esa regla
de arriba puede leer las transacciones, categorías, personas, métodos de pago,
metas, inversiones y pagos programados de **cualquier** familia cuyo id conozca
— y `Family.read`, `FamilyMembership.read` y `RolePermission.read` cuelgan del
mismo hilo, así que también el padrón de integrantes con sus correos.

**Esto es exactamente lo que no pude verificar, y es la pregunta más
importante de esta auditoría.** No hay forma desde este entorno de abrir una
sesión como usuario final restringido, y el rol de servicio no sirve para
probarlo porque salta la RLS por definición. Lo que sí es verificable y está
verificado: el candado que todas las demás apps del portafolio ponen sobre este
campo, aquí no existe. Una sola prueba lo resuelve —`auth.updateMe({data:{
family_id: '<otra familia>'}})` desde una cuenta de prueba y luego leer una
`Transaction` ajena— y vale la pena hacerla antes que cualquier otra cosa de
esta lista.

Nota: las escrituras **no** dependen de ese hilo. `guardedEntityWrite` deriva la
familia de `FamilyMembership` con `status: 'approved'`, así que un `family_id`
falseado no habilita escribir. El riesgo, si existe, es de **lectura**.

#### 2. `Family` no tiene candados de licencia

`"update": {"$or":[{"user_condition":{"role":"admin"}},{"data.admin_user_id":"{{user.id}}"}]}`
y ninguno de `billing_status`, `license_plan`, `licensed_member_limit`,
`license_expires_at`, `trial_end_at`, `auto_renewal`, `payment_reference`,
`activation_notes`, `activated_by_admin` ni los cuatro `last_payment_*` lleva
`rls.write`.

Es el defecto del módulo 1 que puntos cerró el 21 de agosto y rumbo el 19. Más
estrecho que en stockflow —aquí hay que ser el `admin_user_id` de la familia, no
cualquier miembro— pero **el motivo está vivo**: de las seis familias, tres están
`suspended` y una en `view_only`. Son justamente los cuatro administradores con
una razón para poner `active` a mano.

#### 3. `removeMember` acepta un `target_user_id` que nadie ata

`family/handlers/removeMember.ts` comprueba bien lo que le importa: saca el
`family_id` de la membresía **almacenada** y exige que el solicitante sea admin
de **esa** familia. Pero después:

```js
await sr.entities.FamilyMembership.delete(membership_id);
if (target_user_id) {
  const users = await sr.entities.User.filter({ id: target_user_id });
  ...update(target_user_id, { data: { ...users[0].data, family_id: null } });
}
```

`target_user_id` llega del cuerpo y **nunca se compara con `membership.user_id`**.
Un admin que borra legítimamente a alguien de su propia familia puede, en la
misma llamada, poner `family_id: null` al usuario que quiera, de la familia que
sea. La víctima aterriza en onboarding.

Se cura solo —`syncUserFamily` vuelve a derivar el `family_id` de las membresías
propias, que siguen intactas— así que es una molestia, no una pérdida. Pero es
una escritura cruzada entre inquilinos, y es la forma que este módulo busca: el
guardia mira un id y el daño lo hace el segundo id del mismo cuerpo.

### Lo que está bien, y por qué

- **`guardedEntityWrite` cubre las tres mitades.** En create, `family_id:
  familyId` va **después** del spread, así que lo que mande el cliente pierde; en
  update/delete relee el registro y compara contra el **almacenado**
  (`CROSS_TENANT`, 403); y en update hace `delete patch.family_id`. Igual de
  completo que liuma y rumbo.
- **`resolveFamilyAccess` sólo mira membresías `status: 'approved'`**, y cuando
  hay varias elige de forma determinista: la que coincide con el `family_id`
  activo, si no la de `last_active_at` más reciente.
- **Aquí no está el defecto de liuma.** FlowFin también es multi-membresía, pero
  las funciones que reciben una familia pedida la **validan contra las membresías
  del solicitante** y responden 403 si no está (`analytics/handlers/*`
  `resolveAccess`), en vez de resolver por su cuenta. Es la respuesta correcta a
  la pregunta que en liuma tenía tres respuestas distintas.
- **`_agentGuard.ts` dice por escrito que `body.family_id` nunca se usa para
  resolver inquilino** — lo registra para trazas y lo ignora. Con un LLM del otro
  lado del tubo, eso es lo único sensato.
- **Las handlers de `family/` comprueban por los dos lados**: `approveMember` y
  `linkPersonToMember` exigen que el solicitante sea admin de la familia
  reclamada **y** que la membresía objetivo pertenezca de verdad a esa familia.
  `getMyFamily` lleva un comentario explicando que sin su comprobación cualquiera
  leería otra familia. `selfJoin` exige que el correo coincida con el autenticado.
- **`setUserFamilyId`** —el cambio de inquilino a mano— es sólo del dueño de
  plataforma y **falla cerrado** sin `APP_OWNER_EMAIL`.
- **`RolePermission` es create/update/delete de `role: admin` puro.** Un admin de
  familia **no** puede reescribir sus propios permisos. Es lo contrario de lo que
  encontré en stockflow el mismo día, y aquí está bien.

### Una cosa menor

`syncUserFamily` toma `memberships[0]` sin preferir la familia activa, así que a
un usuario con dos membresías puede dejarlo en la otra. No concede acceso —todo
camino de lectura valida la familia pedida contra las membresías— sólo mueve el
puntero. Y de paso: hay transacciones con `family_id`
`69e944d5a12d470e9affdfea`, que no corresponde a ninguna de las seis familias
vivas. Huérfanas, no alcanzables por nadie salvo el rol de plataforma.

### Lo que no pude verificar

Lo dicho en el punto 1, que es lo que más importa: si un usuario final puede
escribir su propio `data.family_id`. Y, como en el resto del portafolio, una
sesión autenticada como miembro de una segunda familia. No sembré datos ni
escribí en producción para averiguarlo: seis familias reales con su contabilidad
dentro no son un laboratorio.
