# 📋 CHECKLIST CRÍTICO DE PUBLICACIÓN

**⚠️ SIN EXCEPCIONES. Cada publicación DEBE pasar todas las validaciones.**

## Orden de Verificación Obligatorio:

### ✅ 1. APP_VERSION en el Código
- **Archivo:** `components/AppUpdateBanner.js` (variable `APP_BUILD_VERSION`)
- **O:** `pages/About.jsx` (variable `CURRENT_VERSION`)
- **Acción:** Actualizar a la nueva versión (ej: `2.5.0`)

### ✅ 2. Base de Datos (AppVersion Entity)
- **Archivo:** AppVersion entity en Base44
- **Acción:** Crear/actualizar registro con la versión del código
- **Verificación:** `AppVersion.version` = `CURRENT_VERSION`

### ✅ 3. Changelog
- **Archivo:** `pages/About.jsx` → `VERSION_HISTORY` array
- **Acción:** Agregar entrada con `version`, `date`, `label: "Actual"`, y `changes: []` listando todos los cambios
- **Verificación:** El changelog describe todos los cambios de esta versión

### ✅ 4. Manual de Usuario
- **Archivo:** `pages/UserManual.jsx` → `sections` array
- **Acción:** Actualizar secciones relevantes con nueva funcionalidad
- **Verificación:** Los artículos del manual reflejan los cambios

---

## Validación Automática:

Usa la función backend `validatePublishReadiness` para verificar automáticamente:

```bash
curl -X POST https://<app>/api/functions/validatePublishReadiness \
  -H "Content-Type: application/json" \
  -d '{
    "codeVersion": "2.5.0",
    "changelogExists": true,
    "manualUpdated": true
  }'
```

Respuesta exitosa:
```json
{
  "readyToPublish": true,
  "message": "✅ TODO OK: App v2.5.0 lista para publicar.",
  "checks": {
    "codeVersion": "PASS",
    "databaseSync": "PASS",
    "changelog": "PASS",
    "userManual": "PASS"
  }
}
```

---

## Flujo de Publicación (Resumen):

1. ✏️ Haz cambios en el código
2. 📝 Actualiza CURRENT_VERSION
3. 📋 Agrega entrada en VERSION_HISTORY
4. 📚 Actualiza secciones en UserManual
5. 🗄️ Crea/actualiza AppVersion entity
6. ✅ Ejecuta validatePublishReadiness → si PASS → Publica
7. 🚀 Deploy a producción

---

## Si algo FALLA:

- ❌ **BLOQUEA la publicación**
- 🔧 Soluciona el problema identificado
- 🔄 Re-ejecuta validatePublishReadiness
- ✅ Solo cuando TODO esté PASS → Publica

---

**Recordatorio:** Este checklist NO es opcional. Es obligatorio para cada publicación.