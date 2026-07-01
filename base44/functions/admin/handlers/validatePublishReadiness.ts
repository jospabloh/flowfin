import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Valida que antes de publicar todo esté sincronizado:
 * ✅ APP_VERSION en código = BD (AppVersion entity)
 * ✅ Changelog tiene entrada para la versión
 * ✅ Manual de usuario (UserManual) tiene actualizaciones
 * 
 * Retorna un reporte con PASS/FAIL para cada validación.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Solo admin puede validar publicación
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const report = {
      timestamp: new Date().toISOString(),
      checks: {},
      readyToPublish: false,
      issues: [],
    };

    // ✅ CHECK 1: Obtener versión actual del código (se pasa como parámetro)
    const payload = await req.json().catch(() => ({}));
    const codeVersion = payload.codeVersion; // Ej: "2.5.0"

    if (!codeVersion) {
      report.checks.codeVersion = 'FAIL';
      report.issues.push('No se proporcionó codeVersion. Ejemplo: { "codeVersion": "2.5.0" }');
      return Response.json(report);
    }

    report.checks.codeVersion = 'PASS';
    report.details = { codeVersion };

    // ✅ CHECK 2: Verificar BD (AppVersion entity)
    try {
      const versions = await base44.asServiceRole.entities.AppVersion.list('-created_date', 1);
      const latestDBVersion = versions[0]?.version;

      if (latestDBVersion === codeVersion) {
        report.checks.databaseSync = 'PASS';
      } else {
        report.checks.databaseSync = 'FAIL';
        report.issues.push(
          `Versión en BD (${latestDBVersion}) ≠ Código (${codeVersion}). ` +
          `Crea/actualiza AppVersion entity con versión ${codeVersion}.`
        );
      }
    } catch (err) {
      report.checks.databaseSync = 'FAIL';
      report.issues.push(`Error al leer AppVersion entity: ${err.message}`);
    }

    // ✅ CHECK 3: Changelog (se valida que exista información de la versión)
    // Nota: El changelog está en pages/About.jsx (VERSION_HISTORY)
    // Aquí hacemos una verificación básica: si el user proporciona que el changelog existe
    const changelogExists = payload.changelogExists === true;
    if (changelogExists) {
      report.checks.changelog = 'PASS';
    } else {
      report.checks.changelog = 'FAIL';
      report.issues.push(
        `Changelog incompleto. Verifica que pages/About.jsx VERSION_HISTORY tenga entrada para v${codeVersion}.`
      );
    }

    // ✅ CHECK 4: Manual de usuario (UserManual.jsx)
    // Verificación básica: user indica si está actualizado
    const manualUpdated = payload.manualUpdated === true;
    if (manualUpdated) {
      report.checks.userManual = 'PASS';
    } else {
      report.checks.userManual = 'FAIL';
      report.issues.push(
        `Manual de usuario incompleto. Verifica que pages/UserManual.jsx contenga nueva funcionalidad.`
      );
    }

    // ✅ RESULTADO FINAL
    const allPassed = Object.values(report.checks).every(status => status === 'PASS');
    report.readyToPublish = allPassed;

    if (allPassed) {
      report.message = `✅ TODO OK: App v${codeVersion} lista para publicar.`;
    } else {
      report.message = `❌ BLOQUEO: Soluciona los ${report.issues.length} problema(s) antes de publicar.`;
    }

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}