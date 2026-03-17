import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import * as XLSX from 'npm:xlsx@0.18.5';

const FAMILY_ID = '69b9a0ad4e71f9e2d7f7fc32';
const FILE_URL = 'https://media.base44.com/files/public/69b97ea9c9a713486b5a01fd/233cb4de4_FinanzasFamilia2026v1.xlsx';

// Category IDs
const CAT = {
  salud:       '69b9a0ae16a0c31864f949ae',
  servicios:   '69b9a0ae16a0c31864f949ab',
  auto:        '69b9a0ae16a0c31864f949b2',
  inversion:   '69b9a0ae16a0c31864f949b3',
  familia:     '69b9a5696db8bd16c91b30d6',
  membresias:  '69b9a5cdf92e73473ac7839e',
};

function mapRubroFix(rubro) {
  if (!rubro) return null;
  const r = String(rubro).toLowerCase().trim();
  if (r.includes('meds') || r.includes('docs')) return CAT.salud;
  if (r.includes('membresia') || r.includes('membresía')) return CAT.membresias;
  if (r.includes('servicios') || r === 'servicios') return CAT.servicios;
  if (r.includes('mochimos')) return CAT.familia;
  if (r.includes('local 09')) return CAT.inversion;
  if (r.includes('mant') && r.includes('carr')) return CAT.auto;
  return null;
}

function formatDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val);
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.substring(0, 10);
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch all transactions without category
  const uncategorized = await base44.asServiceRole.entities.Transaction.filter({
    family_id: FAMILY_ID,
    category_id: null,
    type: 'expense',
  });

  if (!uncategorized.length) return Response.json({ message: 'No hay transacciones sin categoría', updated: 0 });

  // Read Excel to get rubro info
  const resp = await fetch(FILE_URL);
  const buf = await resp.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
  const egSheet = wb.Sheets['Egresos'];
  const rows = XLSX.utils.sheet_to_json(egSheet, { header: 1, defval: null, cellDates: true });

  // Find header row
  let hi = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (Array.isArray(rows[i]) && String(rows[i][1] || '').trim() === 'Quien') { hi = i; break; }
  }

  // Build a map: "date|amount|description" → categoryId from rubro
  const rubroMap = {};
  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const monto = row[5];
    if (!monto || typeof monto !== 'number' || monto <= 0) continue;
    const date = formatDate(row[8]);
    if (!date) continue;
    const rubro = row[2];
    const catId = mapRubroFix(rubro);
    if (!catId) continue;
    const desc = row[4] ? String(row[4]) : (rubro ? String(rubro) : '');
    const key = `${date}|${monto}|${desc}`;
    rubroMap[key] = catId;
  }

  // Match and update
  let updated = 0;
  const notFound = [];
  for (const t of uncategorized) {
    const key = `${t.date}|${t.amount}|${t.description}`;
    const catId = rubroMap[key];
    if (catId) {
      await base44.asServiceRole.entities.Transaction.update(t.id, { category_id: catId });
      updated++;
    } else {
      notFound.push({ id: t.id, date: t.date, amount: t.amount, description: t.description });
    }
  }

  return Response.json({ success: true, updated, notFound });
});