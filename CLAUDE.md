# FlowFin — Project Notes

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
