import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const AUDIT_EMAIL = 'h.josepablo@gmail.com';

interface EntitySchema {
  entity_name: string;
  entity_schema: { properties?: Record<string, unknown> };
}

interface ChangelogDraft {
  id?: string;
  type: string;
  description: string;
  is_published?: boolean;
  published_at?: string;
  published_in_version?: string;
}

interface SchemaSnapshotRecord {
  id?: string;
  schema_data?: Record<string, string[]>;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function sha256first16(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

function buildLiveSchemaMap(schemas: EntitySchema[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const s of schemas) {
    const name: string = s.entity_name;
    const fields = Object.keys(s.entity_schema?.properties ?? {}).sort();
    map[name] = fields;
  }
  return map;
}

function computeSchemaDiff(
  liveMap: Record<string, string[]>,
  snapshotMap: Record<string, string[]>,
): string[] {
  const diff: string[] = [];
  const liveNames = new Set(Object.keys(liveMap));
  const snapNames = new Set(Object.keys(snapshotMap));

  for (const name of liveNames) {
    if (!snapNames.has(name)) {
      diff.push(`Nueva entidad: ${name} (${liveMap[name].length} campos)`);
    } else {
      const liveFields = new Set(liveMap[name]);
      const snapFields = new Set(snapshotMap[name] ?? []);
      for (const f of liveFields) {
        if (!snapFields.has(f)) diff.push(`Campo añadido a ${name}: ${f}`);
      }
      for (const f of snapFields) {
        if (!liveFields.has(f)) diff.push(`Campo eliminado de ${name}: ${f}`);
      }
    }
  }
  for (const name of snapNames) {
    if (!liveNames.has(name)) diff.push(`Entidad eliminada: ${name}`);
  }
  return diff;
}

function computeNewVersion(
  current: string,
  schemaDiff: string[],
  drafts: ChangelogDraft[],
): string {
  const [major, minor, patch] = current.split('.').map(Number);
  const hasNewEntity = schemaDiff.some(d => d.includes('Nueva entidad'));
  const hasFeatureOrBreaking = drafts.some(
    d => d.type === 'feature' || d.type === 'breaking',
  );
  if (hasNewEntity || hasFeatureOrBreaking) return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function buildEmailHtml(opts: {
  runDate: string;
  prevVersion: string;
  newVersion: string;
  changes: string[];
  schemaChangeCount: number;
  draftCount: number;
}): string {
  const changesList = opts.changes
    .map(c => `<li style="margin-bottom:4px">${c}</li>`)
    .join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,sans-serif;background:#f1f5f9;margin:0;padding:16px}
.w{max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.h{background:linear-gradient(135deg,#059669,#047857);padding:24px 32px;color:#fff}
.h h1{margin:0;font-size:18px;font-weight:700}
.h p{margin:4px 0 0;color:#a7f3d0;font-size:12px}
.b{padding:24px 32px;color:#374151;line-height:1.7;font-size:15px}
.b p{margin:0 0 12px}
.g{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin:14px 0;font-size:13px;color:#166534}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:14px}
.row:last-child{border-bottom:none}
.val{font-weight:700;color:#1f2937}
.changes{margin:14px 0;font-size:13px}
.changes ul{margin:6px 0 0;padding-left:1.4em;color:#374151}
.f{padding:16px 32px;background:#f8fafc;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
.f a{color:#059669}
</style></head><body><div class="w">
<div class="h">
  <h1>📚 FlowFin — Auditoría de Documentación</h1>
  <p>${opts.runDate} · Ejecución automática nocturna</p>
</div>
<div class="b">
  <p>Estado: <span style="color:#d97706;font-weight:700">🆕 Nueva versión publicada</span></p>
  <div class="g">
    <div class="row"><span>Versión anterior</span><span class="val">${opts.prevVersion}</span></div>
    <div class="row"><span>Nueva versión</span><span class="val" style="color:#d97706">${opts.newVersion}</span></div>
    <div class="row"><span>Cambios de esquema</span><span class="val">${opts.schemaChangeCount}</span></div>
    <div class="row"><span>Entradas manuales (drafts)</span><span class="val">${opts.draftCount}</span></div>
  </div>
  ${opts.changes.length > 0 ? `
  <div class="changes">
    <strong>Cambios registrados (v${opts.newVersion}):</strong>
    <ul>${changesList}</ul>
  </div>` : ''}
</div>
<div class="f">FlowFin — <strong>ACACIA Consultoría</strong> &nbsp;·&nbsp; <a href="mailto:soporte@acaciaco.com.mx">soporte@acaciaco.com.mx</a></div>
</div></body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const runDate = fmtDate(new Date());

    // Step 1 — Load current schema snapshot
    let currentSnapshot: SchemaSnapshotRecord | null = null;
    try {
      const rows = await base44.asServiceRole.entities.SchemaSnapshot.filter({ is_current: true });
      currentSnapshot = rows?.[0] ?? null;
    } catch (_) {
      // no snapshot yet — treat as empty
    }

    // Step 2 — Fetch live schemas and build comparable map
    const liveSchemas: EntitySchema[] = await base44.asServiceRole.entitySchemas.list();
    const liveMap = buildLiveSchemaMap(liveSchemas);
    const sortedKeys = Object.keys(liveMap).sort();
    const sortedMap: Record<string, string[]> = Object.fromEntries(
      sortedKeys.map(k => [k, liveMap[k]]),
    );
    const liveJson = JSON.stringify(sortedMap);
    const liveHash = await sha256first16(liveJson);
    const entityCount = sortedKeys.length;
    const fieldCount = Object.values(liveMap).reduce((sum, f) => sum + f.length, 0);

    // Step 3 — Compute schema diff
    const snapshotMap: Record<string, string[]> = currentSnapshot?.schema_data ?? {};
    const schemaDiff = computeSchemaDiff(sortedMap, snapshotMap);

    // Step 4 — Load unpublished ChangelogDrafts
    let drafts: ChangelogDraft[] = [];
    try {
      drafts = await base44.asServiceRole.entities.ChangelogDraft.filter({ is_published: false }) ?? [];
    } catch (_) {
      // no drafts table yet — proceed with empty
    }
    const draftStrings = drafts.map((d) => `${d.type}: ${d.description}`);

    // Step 5 — Early exit if nothing changed
    if (schemaDiff.length === 0 && drafts.length === 0) {
      console.log('[dailyDocumentationAudit] No changes detected — exiting silently');
      return Response.json({ success: true, action: 'noop' });
    }

    // Step 6 — Compute new version
    const appVersionRows = await base44.asServiceRole.entities.AppVersion.list('-created_date', 1);
    const appVersionRecord = appVersionRows?.[0] ?? null;
    const prevVersion: string = appVersionRecord?.version ?? '1.0.0';
    const newVersion = computeNewVersion(prevVersion, schemaDiff, drafts);

    // Step 7 — Persist changes (in order)

    // 7.1 Update AppVersion
    if (appVersionRecord?.id) {
      await base44.asServiceRole.entities.AppVersion.update(appVersionRecord.id, { version: newVersion });
    } else {
      await base44.asServiceRole.entities.AppVersion.create({ version: newVersion });
    }

    // 7.2 Mark all AppChangelog records is_current = false
    const currentChangelogs = await base44.asServiceRole.entities.AppChangelog.filter({ is_current: true }) ?? [];
    for (const row of currentChangelogs) {
      if (row.id) await base44.asServiceRole.entities.AppChangelog.update(row.id, { is_current: false });
    }

    // 7.3 Create new AppChangelog
    const allChanges = [...schemaDiff, ...draftStrings];
    await base44.asServiceRole.entities.AppChangelog.create({
      version: newVersion,
      release_date: todayISO(),
      changes: allChanges,
      is_current: true,
    });

    // 7.4 Mark old SchemaSnapshot is_current = false
    if (currentSnapshot?.id) {
      await base44.asServiceRole.entities.SchemaSnapshot.update(currentSnapshot.id, { is_current: false });
    }

    // 7.5 Create new SchemaSnapshot
    await base44.asServiceRole.entities.SchemaSnapshot.create({
      snapshot_date: todayISO(),
      schema_hash: liveHash,
      schema_data: sortedMap,
      entities_count: entityCount,
      fields_count: fieldCount,
      is_current: true,
    });

    // 7.6 Mark all ChangelogDrafts published
    const publishedAt = new Date().toISOString();
    for (const draft of drafts) {
      if (draft.id) {
        await base44.asServiceRole.entities.ChangelogDraft.update(draft.id, {
          is_published: true,
          published_at: publishedAt,
          published_in_version: newVersion,
        });
      }
    }

    // Step 8 — Send audit email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: AUDIT_EMAIL,
      subject: `[FlowFin] Documentación · v${newVersion} publicada · ${runDate}`,
      body: buildEmailHtml({
        runDate,
        prevVersion,
        newVersion,
        changes: allChanges,
        schemaChangeCount: schemaDiff.length,
        draftCount: draftStrings.length,
      }),
      from_name: 'FlowFin Audit',
    });

    console.log(
      `[dailyDocumentationAudit] ${prevVersion} → ${newVersion} | schemaChanges:${schemaDiff.length} drafts:${drafts.length}`,
    );
    return Response.json({
      success: true,
      prevVersion,
      newVersion,
      schemaChangeCount: schemaDiff.length,
      draftCount: drafts.length,
      changes: allChanges,
    });
  } catch (err) {
    console.error(`[dailyDocumentationAudit] Fatal: ${err.message}`);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});
