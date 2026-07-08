# FlowFin — Project Notes

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
