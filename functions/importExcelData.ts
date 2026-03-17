import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import * as XLSX from 'npm:xlsx@0.18.5';

const FAMILY_ID = '69b9a0ad4e71f9e2d7f7fc32';
const FILE_URL = 'https://media.base44.com/files/public/69b97ea9c9a713486b5a01fd/233cb4de4_FinanzasFamilia2026v1.xlsx';

const CAT = {
  alimentacion: '69b9a0ae16a0c31864f949a9',
  transporte:   '69b9a0ae16a0c31864f949aa',
  servicios:    '69b9a0ae16a0c31864f949ab',
  hogar:        '69b9a0ae16a0c31864f949ac',
  entretenimiento: '69b9a0ae16a0c31864f949ad',
  salud:        '69b9a0ae16a0c31864f949ae',
  ropa:         '69b9a0ae16a0c31864f949af',
  educacion:    '69b9a0ae16a0c31864f949b0',
  regalos:      '69b9a0ae16a0c31864f949b1',
  auto:         '69b9a0ae16a0c31864f949b2',
  inversion:    '69b9a0ae16a0c31864f949b3',
  ingreso:      '69b9a0ae16a0c31864f949b4',
};

const PERSONS = {
  'pablo':  '69b9a263f45a58009a81da27',
  'silvia': '69b9a263f45a58009a81da28',
};

const PAYMENT_METHODS = {
  'efectivo':         '69b9a0ae4191c37e2d6be8ec',
  'transferencia':    '69b9a0ae4191c37e2d6be8ed',
  'like u':           '69b9a263f45a58009a81da29',
  'tdc like u':       '69b9a263f45a58009a81da29',
  'volaris':          '69b9a263f45a58009a81da2a',
  'tdc volaris':      '69b9a263f45a58009a81da2a',
  'actinver':         '69b9a263f45a58009a81da2b',
  'debito actinver':  '69b9a263f45a58009a81da2b',
  'débito actinver':  '69b9a263f45a58009a81da2b',
};

function mapRubro(rubro) {
  if (!rubro) return null;
  const r = String(rubro).toLowerCase().trim();
  // Alimentación
  if (/mandado|super|mercado|walmart|soriana|tianguis|tepeyac|carniceria|panaderia|abarrotes|frutas|verduras/.test(r)) return CAT.alimentacion;
  if (/comida|restaurante|taqueria|antojo|cafe|baristop|fondita|lonche|mariscos|sushi|pizza|tacos/.test(r)) return CAT.alimentacion;
  // Transporte
  if (/gasolina|gasolinera|pemex|shell|combustible/.test(r)) return CAT.transporte;
  if (/\buber\b|didi|taxi|transporte pub/.test(r)) return CAT.transporte;
  // Auto
  if (/\bbmw\b|seguro auto|tenencia|iave|tag vial|verificacion|taller|refacci/.test(r)) return CAT.auto;
  // Servicios
  if (/\bluz\b|cfe|electricidad|internet|cable|wifi|celular|telefon|streaming|naturgy|gas natu|gas dom|sap|capas|sacm|recarga/.test(r)) return CAT.servicios;
  // Hogar
  if (/hogar|mueble|limpieza|mantenimiento|reparacion|plomero|pintura|lavanderia|ferrete/.test(r)) return CAT.hogar;
  // Salud
  if (/doctor|medico|farmacia|gym|gimnasio|salud|dental|laboratorio|hospital|optim|optica|consulta/.test(r)) return CAT.salud;
  // Educación
  if (/colegio|escuela|universidad|educac|libro|clase|curso|taller|kinder/.test(r)) return CAT.educacion;
  // Entretenimiento
  if (/entret|cine|teatro|viaje|vacacion|hotel|turismo|parque|concierto/.test(r)) return CAT.entretenimiento;
  // Ropa
  if (/ropa|calzado|zapato|vestido|pantalon|camisa/.test(r)) return CAT.ropa;
  // Regalos
  if (/regalo|donac/.test(r)) return CAT.regalos;
  // Inversión
  if (/actinver|allianz|invers|acacia|acaciaco|ahorro/.test(r)) return CAT.inversion;
  return null;
}

function mapPaymentMethod(forma) {
  if (!forma) return null;
  return PAYMENT_METHODS[String(forma).toLowerCase().trim()] || null;
}

function mapPerson(quien) {
  if (!quien) return null;
  return PERSONS[String(quien).toLowerCase().trim()] || null;
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

const VALID_REQUIRED = ['Necesario', 'Gusto', 'Urgente', 'Inversión', 'Otro'];
function mapRequired(val) {
  if (!val) return 'Necesario';
  const v = String(val).trim();
  return VALID_REQUIRED.find(t => t.toLowerCase() === v.toLowerCase()) || 'Necesario';
}

async function bulkInsert(base44, records) {
  for (let i = 0; i < records.length; i += 100) {
    await base44.asServiceRole.entities.Transaction.bulkCreate(records.slice(i, i + 100));
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resp = await fetch(FILE_URL);
    const buf = await resp.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });

    const results = { expenses: 0, income: 0, unmappedRubros: {} };

    // ===== EGRESOS =====
    const egSheet = wb.Sheets['Egresos'];
    if (egSheet) {
      const rows = XLSX.utils.sheet_to_json(egSheet, { header: 1, defval: null, cellDates: true });

      // Find header row: row where index 1 = 'Quien'
      let hi = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        if (Array.isArray(rows[i]) && String(rows[i][1] || '').trim() === 'Quien') {
          hi = i; break;
        }
      }
      if (hi < 0) return Response.json({ error: 'No se encontró encabezado en Egresos' }, { status: 400 });

      // Col positions: [1]=Quien [2]=Rubro [3]=SubRubro [4]=Detalle [5]=Monto
      //               [6]=Forma [7]=Factura [8]=Fecha [9]=Requerido [10]=Semana
      const transactions = [];
      for (let i = hi + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const monto = row[5];
        if (!monto || typeof monto !== 'number' || monto <= 0) continue;
        const date = formatDate(row[8]);
        if (!date) continue;

        const rubro = row[2];
        const catId = mapRubro(rubro);
        if (!catId && rubro) {
          const key = String(rubro).trim();
          results.unmappedRubros[key] = (results.unmappedRubros[key] || 0) + 1;
        }

        const factura = String(row[7] || '').toLowerCase();
        transactions.push({
          family_id: FAMILY_ID,
          date,
          type: 'expense',
          amount: monto,
          description: row[4] ? String(row[4]) : (rubro ? String(rubro) : ''),
          category_id: catId || undefined,
          person_id: mapPerson(row[1]) || undefined,
          payment_method_id: mapPaymentMethod(row[6]) || undefined,
          required_type: mapRequired(row[9]),
          has_invoice: factura === 'si' || factura === 'sí',
          week: typeof row[10] === 'number' ? row[10] : undefined,
        });
      }

      await bulkInsert(base44, transactions);
      results.expenses = transactions.length;
    }

    // ===== SILVIA INGRESOS =====
    const ingSheet = wb.Sheets['Silvia Ingresos'];
    if (ingSheet) {
      const rows = XLSX.utils.sheet_to_json(ingSheet, { header: 1, defval: null, cellDates: true });

      // Find header row where index 0 = 'Fecha'
      let hi = -1;
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        if (Array.isArray(rows[i]) && String(rows[i][0] || '').trim() === 'Fecha') {
          hi = i; break;
        }
      }
      if (hi < 0) hi = 0; // fallback

      // Col positions: [0]=Fecha [1]=Quien/Source [2]=Tipo [3]=Monto [4]=Comentario
      const incomeT = [];
      for (let i = hi + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const monto = row[3];
        if (!monto || typeof monto !== 'number' || monto <= 0) continue;
        const date = formatDate(row[0]);
        if (!date) continue;

        incomeT.push({
          family_id: FAMILY_ID,
          date,
          type: 'income',
          amount: monto,
          description: row[4] ? String(row[4]) : (row[1] ? String(row[1]) : 'Ingreso'),
          category_id: CAT.ingreso,
          person_id: PERSONS.silvia,
        });
      }

      await bulkInsert(base44, incomeT);
      results.income = incomeT.length;
    }

    return Response.json({ success: true, results });
  } catch (err) {
    return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
});