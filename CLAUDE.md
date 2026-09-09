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

## Módulo 15 — el puente con Mission Control: una llave por app (2026-08-23)

`INGEST_HMAC_SECRET` es **un solo valor compartido por todo el portafolio**, así
que una firma hecha con él demuestra «alguien tiene el secreto compartido» y
nunca «esto es FlowFin». Como el nombre de la app viaja en el cuerpo, cualquier
app podía firmar una carga diciendo ser otra y Mission Control la escribía con
esa atribución. Lo encontró la auditoría del módulo 14 de Mission Control.

El arreglo es dejar de usar el maestro directamente:

    appKey = HMAC-SHA256(maestro, "acacia.app.v1." + slug)

El prefijo es separación de dominio: garantiza que una llave derivada no puede
coincidir con una firma sobre un cuerpo, y el `v1` permite rotar el esquema sin
rotar el maestro.

`base44/functions/acaciaControl/_acaciaSign.ts`
es **idéntico byte a byte en todas las apps del portafolio**. La fuente
canónica vive en `jospabloh/acacia-app-standard` →
`shared/bridge/acaciaSign.ts`: cámbialo allí y cópialo, no lo edites aquí.
Aquí lo usa `acaciaControl` para **verificar** lo que llega de Mission Control.

**La migración tiene un orden y es el contrario del obvio.** La verificación
acepta las dos llaves mientras `ACCEPT_LEGACY_MASTER` sea `true`, así que da
igual quién despliegue primero. Pero Mission Control despliega al mergear y las
apps a mano, así que MC siempre va primero — por eso MC sigue **firmando** con
el maestro hasta que las nueve apps acepten derivada. **Los dos pasos ya están hechos** (2026-08-24): MC firma con `signFor` y
`ACCEPT_LEGACY_MASTER` está en `false` en los once sitios, así que una firma con
el maestro **ya no se acepta** — que es exactamente lo que cierra el agujero. `ACACIA_APP_SLUG=flowfin` está puesto en los secrets de esta app y
verificado: la sincronización de las 16:29 UTC del 2026-08-24 no registró ni una
advertencia contra ella. Importa que sea exacto ahora más que nunca — con el
flag en `false` un valor ausente o mal escrito ya no degrada a legacy, falla.

**Y ahora hay una prueba, que es lo que faltaba.** El helper no lo comprobaba
nada: cada PR de este módulo decía que recibía su primer type-check al
desplegar. `acaciaSign.test.ts` (canónico en el repo estándar) fija el vector
que la mitad Node de Mission Control ya fijaba —dos implementaciones de HMAC en
dos runtimes sólo siguen siendo iguales si algo lo afirma, y una divergencia se
ve en runtime como `bad signature` en cada llamada, que parece un secreto mal
puesto y no lo es— y afirma lo que este módulo promete: un cuerpo firmado por
una app que dice ser otra **no** verifica. No tiene imports externos ni toca la
red, así que corre en un sandbox donde `jsr.io` y `deno.land` están bloqueados.
En este repo vive en `base44/functions/_acaciaSign.test.ts` — en la **raíz** de
`functions/`, no dentro de un directorio, porque cada directorio ahí es un
endpoint desplegado y un test no lo es. `npm`/CI ya lo corren: `deno lint
base44/functions/` y `deno test base44/functions/` son pasos de `ci.yml`.

**La criptografía en línea que esto reemplaza ya no está.** Cada `acaciaControl`
llevaba su propio `stableStringify` / `hmacHex` / `timingSafeEqual`, copiados a
mano contra `api/_lib/ingestSign.js` de Mission Control. Dejarlos al lado del
helper no es desorden: es una segunda implementación de la misma rutina en el
mismo archivo, que es exactamente la deriva que este módulo quita.

### `deno` SÍ se puede correr aquí — este archivo decía lo contrario

Este CLAUDE.md repetía «deno no está disponible en este sandbox» y por eso
varios cambios de `base44/functions/` se dieron por no verificables y se
mandaron a que CI los mirara por primera vez. **Es falso.** El binario se baja
de la release de GitHub —el mismo sitio de donde lo saca `setup-deno` en el
runner— y GitHub sí pasa por el proxy:

    curl -sSL -o deno.zip https://github.com/denoland/deno/releases/download/v2.9.5/deno-x86_64-unknown-linux-gnu.zip
    unzip -q deno.zip && chmod +x deno && ./deno --version

Lo que de verdad está bloqueado es `deno.land` y `jsr.io`, así que un test que
importe de ahí no resuelve; uno que no importe nada corre igual que en CI. Es la
misma lección que el `000` del proxy en Mission Control: **que una vía esté
bloqueada no significa que la pregunta no tenga respuesta.**

## Onboarding volvía a "crear o unirte" con una solicitud pendiente (fixed 2026-08-25)

Reportado por una usuaria de Mochi Family: envió una solicitud para unirse a una
familia por código, y en cada recarga (frecuente en iOS — un PWA/tab en
background se mata y se repinta al volver del sistema) la app la devolvía a la
pantalla en blanco de "crea tu familia o únete a una existente", como si nunca
hubiera pedido acceso.

**Causa raíz:** `Onboarding.jsx` guarda `pendingApproval` en estado local de
React — se pierde en cualquier remount. Para sobrevivir a un reload, su efecto
de montaje llama a `family.getMyMembership` (`asServiceRole`, bypassa RLS) y
sólo reacciona si encuentra membresía **aprobada**. El propio handler filtraba
`status: 'approved'` en la query — una fila `pending` (la que `selfJoin.ts` crea
al pedir acceso) no aparecía en el resultado, así que el "self-heal" no tenía
nada que heal-ear: `membership` salía `null` y la pantalla volvía al choose
inicial en vez de "Solicitud enviada".

En cuentas verificadas contra Base44 en vivo esto **no** era el caso — la
usuaria que lo reportó ya tenía una fila `approved` limpia (probablemente
alcanzó a ser aprobada entre el reporte y la revisión) — pero el bug es real y
reproducible independientemente: cualquier usuario entre "pedí acceso" y "el
admin me aprobó" que recargue la app cae en el mismo hueco. iOS lo hace más
probable, no exclusivo — un remount ahí es rutina, no una excepción.

**Arreglo:** `getMyMembership.ts` ahora trae **todas** las membresías del
usuario (sin filtrar `status` en la query) y elige la aprobada si existe; si no,
reporta `pending: true` cuando hay una fila `pending` entre las suyas.
`Onboarding.jsx` usa ese flag para llamar `setPendingApproval(true)` en vez de
no hacer nada, así que un reload durante la espera muestra "Solicitud enviada"
otra vez, no el choose inicial. Sin cambio de forma para el caso ya cubierto
(`membership` aprobada sigue funcionando idéntico); `pending` es un campo nuevo,
aditivo.

**Verificado:** `npm run lint` (incl. `validate:functions`), `npm run build`
(incl. `permissions-check.mjs`), `npm run validate:rls` (36 entidades) y
`deno lint` sobre el handler tocado — todo en verde. Sin test de regresión
automatizado: como el resto de `family/handlers/*.ts`, `getMyMembership.ts`
importa el SDK de Base44 por red (`npm:@base44/sdk`), así que no es candidato a
un `logic.ts` puro al estilo `guardedEntityWrite` sin mockear esa dependencia —
mismo límite que ya documentó el fix del tutorial. No requiere deploy de
entidades (no se tocó `base44/entities/`); si toca desplegarse, requiere tanto
`npm run deploy` (la función) como `npm run deploy:site` (el frontend) — ver
"Base44 — mergear a `main` no deploya NADA" arriba.

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

## `functions deploy --force` puede reportar "unchanged" para una función que sí cambió (2026-08-25)

Al desplegar el módulo 18 de arriba, `npx base44 functions deploy --app-id ... --force`
reportó `family unchanged` — **dos veces**, en dos corridas separadas — aunque
`switchFamily.ts` y `switchFamilyLogic.ts` eran archivos nuevos dentro de
`family/handlers/` y `family/handlers/index.ts` se había editado para
registrar la nueva acción.

**No era un falso positivo del reporte: el `unknown action 'switchFamily'` era
real.** Se verificó contra el sitio desplegado — no contra el sandbox del app,
que sí traía los archivos nuevos (el sandbox se reconstruye desde el último
commit, así que confirmar ahí no prueba que el runtime de funciones se haya
re-publicado). La prueba decisiva fue una petición POST sin autenticar
directamente al endpoint de funciones desplegado:

```bash
curl -s -X POST "https://<tu-dominio>.base44.app/api/apps/<app-id>/functions/family" \
  -H "Content-Type: application/json" -H "X-App-Id: <app-id>" \
  -d '{"action":"switchFamily","family_id":"probe"}'
# {"error":"family: unknown action 'switchFamily'"}
```

(Nota la URL: el SDK del cliente pasa `serverUrl: ''` en `base44Client.js`, así
que las llamadas de `functions.invoke` van a una ruta **relativa**
`/api/apps/<app-id>/functions/<nombre>` contra el dominio del sitio
desplegado — no a `base44.app` directamente. Un primer intento contra
`https://base44.app/apps/.../functions/family` dio `405`, que no prueba nada:
es la URL equivocada, no una señal sobre el deploy.)

Una acción ya desplegada desde antes (`getMyMembership`) respondía `401`
(pasó el ruteo, falló el `auth.me()`) contra el mismo endpoint — así que el
ruteo del sitio funcionaba; specficamente la acción nueva nunca llegó al
bundle publicado.

**El arreglo:** tocar `family/entry.ts` (el archivo con `Deno.serve`, el punto
de entrada real de la función) con un cambio de contenido — un comentario
basta — y volver a correr `npm run deploy`. El detector de cambios de la CLI
parece comparar contra el archivo de entrada y no recorre recursivamente
`handlers/`, así que agregar o modificar un handler sin tocar `entry.ts`
puede no disparar un redeploy real, con el reporte "unchanged" ocultándolo.

**Lección general, van dos veces con este mismo patrón** (la primera fue
"mergear no deploya nada" — ver arriba): un reporte de éxito de la
herramienta de deploy no es evidencia de que el runtime cambió. Verificar
contra el endpoint desplegado, no contra el mensaje de la CLI ni contra el
sandbox del app.

## Las automatizaciones que convierten pagos en movimientos (revisión 2026-08-26)

Revisión pedida tras notar movimientos raros. Cinco cosas estaban mal; todas
salieron de leer los datos en vivo, no de leer el código.

### El campo del que dependía el anti-duplicado no existía

`ScheduledPaymentRecord` declaraba **siete** propiedades. El frontend escribía
tres más —`status`, `origin`, `linked_transaction_id`— y Base44 las descartaba
en silencio, porque un campo no declarado no se persiste.

La consecuencia estaba en `createTransactionFromScheduledPaymentRecord`, cuya
primera guarda es:

```js
if (scheduledPaymentRecord.linked_transaction_id) return;  // nunca se cumplía
```

**Ese `if` jamás pudo dispararse.** `ConvertScheduledModal` pasa
`linked_transaction_id` en el `create` precisamente para que el hook se
abstenga, y el campo se caía por el camino. Lo único que evitaba el movimiento
duplicado ahí era la limpieza defensiva que el propio modal hace *después*
—borrar cualquier otra transacción que apunte al registro—, es decir, un
parche a un síntoma cuya causa llevaba meses invisible.

Los tres campos ya están declarados, en el repo y en el esquema desplegado
(vía `update_entity_schema`, aditivo, RLS preservada — **no** con
`deploy:entities`, que es destructivo y pide confirmación interactiva).

### Quién crea el movimiento ahora es determinista

El hook y el frontend corrían en paralelo sobre la misma pregunta —«¿ya existe
un movimiento para este registro?»— y ninguno podía ganarla de forma fiable: el
hook dispara al crearse el registro, que es exactamente cuando el frontend
todavía no ha creado su transacción. Ambos chequeaban duplicados y aun así la
carrera se resolvía distinto cada vez. Se ve en agosto de Mochi Family: de seis
registros, cinco tienen el movimiento del frontend (`"🎬 Apple TV"`, notas
vacías) y uno el del hook (`"Apple TV"`, notas `"Pago programado: …"`). El mismo
pago descrito de dos maneras según quién llegó primero.

`origin` resuelve esto sin tocar el panel: cada camino que lo declara crea su
propio movimiento, y el hook se aparta.

| `origin` | Quién crea el movimiento |
|---|---|
| `manual` | `ScheduledPayments.jsx` → `useRegisterPaymentWithTransaction` |
| `converted` | `ConvertScheduledModal.jsx` (reusa el movimiento existente) |
| `auto` | `autoPostScheduledPayments` |

El hook sigue desplegado como red para registros creados de cualquier otra
forma (API directa, importaciones), y ahora el movimiento que sí llega a crear
lleva `scheduled_payment_id` y `required_type`, que antes le faltaban — sin
`scheduled_payment_id`, `findMatchingScheduledPaymentTransaction` no lo ve.

### El autopost borraba los pagos capturados a mano

`autoPostScheduledPayments` hacía `update()` **incondicional** sobre el registro
del mes si ya existía, y corre **todos los días** desde `due_day` hasta fin de
mes. Pisaba `paid_date` con hoy, `amount_paid` con el monto nominal, `paid_by`
con `"Sistema (auto)"` y `notes` con `"Autopost <mes>"`. Un pago que capturaste
el día 12 por $540 amanecía el 13 como pagado hoy por el monto de catálogo, por
el sistema, sin tus notas — y otra vez al día siguiente.

Ahora un registro existente **no se toca**: el mes ya está cubierto, así que lo
único pendiente es asegurar que el movimiento exista. Y el movimiento se
construye leyendo `record.paid_date` / `record.amount_paid`, no los valores
nominales del domiciliado, para que mande el dato real.

**Esto nunca llegó a ocurrir en producción, y por una razón incómoda: el
autopost jamás ha corrido.** Cero registros con `paid_by: "Sistema (auto)"`,
cero movimientos con notas `"Creado automáticamente"`, en toda la base — pese a
ocho domiciliados con `automation_mode: auto` y `autopost_enabled: true` cuyos
días de vencimiento ya pasaron varias veces. Su `guardInternal` exige
`CRON_SECRET` + header `x-cron-secret`, o un admin autenticado; un scheduler sin
el header recibe **403**. Falta comprobar en el panel de Base44 si la automation
existe y si el secreto está puesto — **no es verificable desde el sandbox**.
Arreglar el clobbering primero es deliberado: encender el cron con el `update()`
anterior habría destruido el historial de los seis registros de agosto.

### MSI no generaba movimientos, nunca

37 `MSIPayment` en producción, **0** transacciones con `msi_payment_id`. Doble
falla, y cada mitad tapaba a la otra:

- `MSIPage.handleMarkPaid` pasaba `category_id: undefined, person_id: undefined`
  a `registerPayment`, cuya guarda es `if (!matchingTx && category_id &&
  person_id)`. Nunca creaba nada, y la UI reportaba éxito igual.
- El hook `createTransactionFromMSIPayment` leía `msi.category_id` y
  `msi.payment_method_id`, campos que **no existían** en la entidad `MSI`, y
  además hardcodeaba `person_id: ''` contra su propia guarda.

`MSI` ahora declara `category_id`, `payment_method_id` y `person_id` (repo +
esquema desplegado); el formulario los pide y `handleMarkPaid` bloquea con un
toast explicativo si faltan, en vez de fingir que registró el pago — mismo
patrón que `ScheduledPayments.jsx` ya usaba.

### `registerPayment` stampaba el id en la columna equivocada

`scheduledPaymentRecordId` se derivaba como «`primaryResult.id` salvo que venga
un `rental_payment_id`», así que para MSI habría escrito un id de `MSIPayment`
dentro de `scheduled_payment_record_id`. Estaba latente sólo porque MSI nunca
creaba transacciones; al arreglar MSI se habría activado el mismo día. Ahora un
`ScheduledPaymentRecord` se reconoce por llevar `scheduled_payment_id`, y
cualquier otro llamador nombra su columna con `link_field_from_primary`.

### Los tres hooks de Investment/Rental/MSI son inertes a propósito

Los tres hardcodean `category_id: ''` / `person_id: ''` y acto seguido se
auto-descartan. **No son un bug a reparar:** `Investments.jsx`, `Rentals.jsx` y
`MSIPage.jsx` ya crean el movimiento, y darles valores reales duplicaría cada
pago. Llevan un comentario que lo dice, porque el siguiente que los lea va a
querer "arreglarlos".

Siguen desplegados porque el entity hook está **registrado en el panel** —
`npm run functions:audit` los marca `hook/cron (declarado)`. Borrarlos exige
desregistrarlos ahí primero y luego redeployar con `--force`; no se hizo en este
cambio. Vale la pena: estamos en **45/45 endpoints, margen 0**.

### Verificado

`npm run lint` (incl. `validate:functions`), `npm run build` (incl.
`permissions-check`), `npm run validate:rls` (36 entidades), `deno lint` (126
archivos) y `deno test` (32 tests) — todo en verde. **No verificado:** una
sesión real marcando un MSI o un domiciliado como pagado; este repo no tiene
runner de tests de frontend. Requiere `npm run deploy` (funciones) **y**
`npm run deploy:site` (frontend) — mergear no deploya nada.

## Las cuotas de inversión se registraban solas (2026-09-02)

Reportado por Mochi Family: la cuota 16 de LOCAL 09 ALBASERRADA apareció como
pagada sin que nadie la confirmara, y nunca salió en los pendientes del mes.

**No fue un cron ni una automatización.** Las 18 cuotas existen como filas de
`InvestmentPayment` desde el 2026-03-26 — se sembraron todas juntas, con notas
`"m16 - pablo - pendiente"`, `"m17 - …"`, `"m18 - …"`. Es el calendario
completo, no pagos. Y la UI de Inversiones **no tenía noción de pendiente vs.
pagado**: contaba como pagada toda fila con `date <= hoy`. La cuota 16 tiene
fecha 2026-09-02, que era ese día. Se registró sola porque le llegó su fecha, y
17 (02 oct) y 18 (02 nov) habrían hecho lo mismo.

Es la clase de fallo que este archivo ya documenta dos veces en la sección de
automatizaciones de pago: **el estado se estaba infiriendo en vez de
almacenarse**, y el criterio vivía copiado en cuatro pantallas. La prueba de
que la 16 no estaba pagada es que las cuotas 12–15 sí tienen `Transaction`
vinculada y la 16, 17 y 18 no tienen ninguna.

**Arreglo, en dos mitades:**

1. **Una fila de `InvestmentPayment` ES una cuota confirmada, sin filtro por
   fecha** — el mismo modelo que `MSIPayment` y `ScheduledPaymentRecord` ya
   usan. `src/lib/investmentSchedule.js` (`countPaidInstallments` /
   `getNextInstallment`) reemplaza las **cuatro** copias del cálculo que había
   en `InvestmentCard`, `InvestmentDetailSheet`, `Investments.jsx` y
   `useDashboardData.js` — y era justo en esas copias donde vivía el filtro por
   fecha. Un pago futuro registrado a propósito (una prórroga, un adelanto)
   ahora cuenta, que es lo correcto.
2. **Las cuotas del mes salen en "Pagos del Mes"**, junto a los pagos
   programados manuales, con su propio botón de confirmar
   (`src/components/scheduled/InvestmentInstallmentItem.jsx`). Cuentan en los
   chips "Pendientes", "Pagados este mes" y "Manuales" — nunca en
   "Automáticos": una cuota de inversión no es domiciliada, siempre la confirma
   una persona. No participan de Pausados/Archivados, que son estados del
   `ScheduledPayment`; una inversión se administra desde su propia página.
   `src/hooks/useRegisterInvestmentPayment.js` extrae el par
   `InvestmentPayment` + `Transaction` (con su rollback) que antes estaba
   inline en `Investments.jsx`, para que las dos pantallas escriban lo mismo.

**Los datos hay que limpiarlos a mano, y sin eso el arreglo empeora las cosas:**
sin filtro de fecha, las tres filas sembradas (cuotas 16, 17 y 18, ids
`69c48c71c16008057e9d0816/0817/0818`) cuentan como pagadas de inmediato y la
inversión se lee 18/18 "Completado". Hay que borrarlas desde Inversiones →
LOCAL 09 → Historial de pagos → papelera. Quedan 15 pagadas y la cuota #16 sale
como pendiente para que su dueño la confirme — cosa que además crea el
movimiento en Movimientos, que hoy no existe para esa cuota. El MCP de Base44
**no tiene herramienta de borrado** (sólo `create_entities` /
`update_entities`), así que esto no se puede hacer desde un sandbox.

**Verificado:** `npm run lint` (incl. `validate:functions`), `npm run build`
(incl. `permissions-check`) y `npm run validate:rls` (36 entidades) en verde,
más una comprobación aparte del cálculo del calendario contra los datos reales
de LOCAL 09 (15 pagadas → siguiente cuota #16 el 2026-09-02; con las 3 filas
sembradas dentro → `null`, o sea "Completado"). **No verificado:** una sesión
real confirmando la cuota desde Pagos del Mes; este repo no tiene runner de
tests de frontend. Sólo frontend — no se tocó `base44/`, así que requiere
`npm run deploy:site` y **no** `npm run deploy`.

## Un gasto en moneda extranjera se guardaba sin convertir (2026-09-03)

Reportado por Mochi Family: el movimiento del día, `PANADERIA MARACAIBO`, salía
como **−$1,300.00 MXN / CRC 1,300.00**, mientras que el del sábado anterior
(`Comida`, −$193.24 / CRC 5,176.99) sí estaba convertido. El mismo formulario,
cuatro días de diferencia.

**Evidencia, leída de la base en vivo:**

| fecha | descripción | amount | original_amount | exchange_rate |
|---|---|---|---|---|
| 2026-08-29 | Comida | 193.24 | 5176.99 CRC | 0.037327 |
| 2026-08-29 | Cuidado personal | 403.90 | 10820 CRC | 0.037329 |
| **2026-09-03** | **PANADERIA MARACAIBO** | **1300** | **1300 CRC** | **null** |

`exchange_rate: null` con `amount === original_amount` es la firma exacta del
fallo. No es que la conversión se hiciera mal: **no se hizo, y se guardó igual.**

**Causa raíz — un `return` que dejaba en su sitio un número ajeno.** En
`Capture.jsx` el efecto que convierte empezaba así:

```js
if (!tripId || !originalAmount || !exchangeRate) return;   // ← el bug
```

`getExchangeRate` (`src/services/exchangeRateService.js`) devuelve `null` cuando
`open.er-api.com` no responde — no lanza, no avisa: devuelve `null`. Con eso el
efecto salía por arriba y **`amount` conservaba lo que ya tuviera**, que en un
ticket costarricense es la cifra en colones: la pone el escaneo del recibo
(`aiExtract` hace `setAmount(String(data.amount))` con el número que lee del
papel) o el propio usuario. La única señal era una línea de texto gris —
*"No se pudo obtener el TC. Ingresa el monto manualmente."*— debajo del campo, y
nada impedía guardar. Un gasto de $48 entró a la contabilidad como $1,300.

**Arreglo, en tres partes, y la primera es la que importa:**

1. **El efecto ahora BORRA `amount` cuando no puede calcularlo**, en vez de
   `return`. Mientras la moneda es extranjera ese efecto es el **único**
   escritor de `amount` (el campo pasa a `readOnly`), así que un TC que no llega
   deja el monto vacío — visible— en lugar de dejar la cifra extranjera
   disfrazada de pesos.
2. **El TC se puede escribir a mano**, como ya se podía en
   `TransactionEditModal`. Que el formulario de captura no tuviera esa salida
   siendo que el de edición sí, era la asimetría de fondo.
3. **Guardar está bloqueado sin TC usable**, con un toast que dice qué falta.
   `exchange_rate` ya no puede salir `undefined` para una moneda extranjera.

`TransactionEditModal` tenía el mismo agujero en su mitad —su recálculo también
se saltaba en silencio, y `handleSave` escribía `exchange_rate: undefined` sin
protestar— y se cerró igual: limpia el monto, marca el error en rojo y
deshabilita el botón. Es justo la pantalla a la que uno va a corregir una fila
así, y no servía de nada si repetía el fallo.

**Dato en vivo corregido:** la fila `6a997b49777496b1ba7658ca` quedó en
`amount: 48.53`, `exchange_rate: 0.037329`. **El TC no es el del 3 de septiembre:
es el último observado en sus propios datos (29 de agosto)** — el proxy de este
sandbox no alcanza ningún endpoint de divisas (`http=000` contra
`open.er-api.com`, `frankfurter.app` y `exchangerate.host`), así que no había
forma de leer el real. En un par tan estable son centavos sobre $48, y dejar
$1,300 fantasma en septiembre era peor; aun así, si el TC del día importa, se
edita desde el movimiento y el monto se recalcula solo.

**Queda una fila con la misma firma y NO se tocó:** `6a08e50974db489cbdedaed3`
(2026-05-16, *Spotify AB via Google Play*, `amount: 239`, `original_amount: 239
USD`, `exchange_rate: null`, familia `69b9a0ad4e71f9e2d7f7fc32`). Aquí lo
probable es lo contrario: $239 **MXN** es un cargo de Spotify plausible y $239
USD no, así que el monto está bien y lo que sobra es la etiqueta `USD`. Corregir
el monto la habría roto. Es de otra familia y hace falta que su dueño diga cuál
de los dos campos es el equivocado.

**Verificado:** `npm run lint` (incl. `validate:functions`), `npm run build`
(incl. `permissions-check`) y `npm run validate:rls` (36 entidades) en verde, más
la relectura de la fila corregida contra la base. **No verificado:** una captura
real con el TC caído; este repo no tiene runner de tests de frontend y el
endpoint de divisas no es alcanzable desde aquí, así que la rama de fallo se
razonó del código, no se ejercitó. Sólo frontend — no se tocó `base44/`, así que
requiere `npm run deploy:site` y **no** `npm run deploy`.

### Seguimiento (2026-09-09): «el único escritor» no era cierto

Al releer el arreglo de arriba ya mergeado, el comentario que dejé afirmaba que
mientras la moneda es extranjera el efecto de conversión es **el único escritor
de `amount`**. No lo era. Quedaban cuatro:

```
aiExtract        setAmount(String(data.amount))      // el escaneo del recibo
startVoice       setAmount(String(parsedAmount))     // el dictado
PredictiveChips  setAmount(String(chip.amount))      // el chip predictivo
CalculatorWidget setAmount(String(result))           // la calculadora
```

**Ninguno de los cuatro toca una dependencia del efecto**, así que el efecto no
vuelve a correr para corregirlos: lo que escriben se queda. Y `readOnly` no los
frena — bloquea el teclado del usuario, no un `setState`.

La secuencia que lo reproduce es sólo cuestión de orden:

1. eliges el viaje y CRC → el efecto limpia el monto (el arreglo funciona);
2. **después** escaneas el ticket → el OCR mete 1300 directo en `amount`;
3. el TC sí se obtuvo, así que `hasUsableRate` es verdadero y la guarda de
   guardado **no** dispara;
4. se guarda `amount: 1300`, y encima con `original_amount: undefined`.

Es el bug del 3 de septiembre otra vez, con el mismo desenlace en el mismo
campo. Sobrevivió al arreglo porque escanear-primero era el orden que probé
mentalmente y ahí sí se corrige (elegir el viaje cambia `isForeignCurrency` y el
efecto corre); viaje-primero no lo probé.

**Arreglo:** los cuatro pasan por `setCapturedAmount`, que cuando la moneda es
extranjera escribe en `originalAmount` y no en `amount`. No es sólo una guarda:
es lo que esos números **son**. La cifra impresa en un ticket costarricense son
colones, no pesos — mandarla al campo de colones y dejar que el efecto la
convierta es la lectura correcta, y de paso el monto en pesos aparece solo.

Lee `isForeignCurrency` de un ref, no del closure: `aiExtract` es `async` y
resuelve bastante después del clic, así que el valor capturado en su render
puede estar viejo si eliges el viaje mientras el escaneo va en vuelo.

**La lección, y es la que vale más que el arreglo:** escribí «el único escritor»
como comentario y no lo comprobé con un `grep setAmount(`. Un invariante que se
afirma en prosa y no se verifica contra el archivo es una suposición con tipografía
de hecho — y aquí el `grep` cabía en una línea y devolvía los cuatro
contraejemplos de inmediato.

**Verificado:** `npm run lint` (incl. `validate:functions`), `npm run build`
(incl. `permissions-check`) y `npm run validate:rls` (36 entidades) en verde,
más `grep -n "setAmount("` para confirmar que ya sólo quedan como escritores el
propio efecto, los dos reseteos de después de guardar y el `onChange` del input
(que es `readOnly` mientras la moneda es extranjera). **No verificado:** la
secuencia en un navegador real — este repo sigue sin runner de tests de
frontend. Sólo frontend: requiere `npm run deploy:site`.
