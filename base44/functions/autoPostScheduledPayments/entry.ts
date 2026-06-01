import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const todayIso = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

// Internal guard: allow either a valid CRON_SECRET header OR an authenticated admin user.
async function guardInternal(base44, req) {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const headerSecret = req.headers.get('x-cron-secret') || req.headers.get('X-Cron-Secret');
  if (cronSecret && headerSecret === cronSecret) return null;
  try {
    const user = await base44.auth.me();
    if (user?.role === 'admin') return null;
  } catch { /* not authenticated */ }
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

function formatCurrency(n) {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n) || 0);
  } catch {
    return `$${(Number(n) || 0).toFixed(2)}`;
  }
}

function buildSummaryHtml({ month, postedItems, families }) {
  const rows = postedItems.map(i => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;">${i.familyName || '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;">${i.icon || '📅'} ${i.name}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${formatCurrency(i.amount)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;">${i.type === 'income' ? 'Ingreso' : 'Egreso'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;">${i.status}</td>
    </tr>
  `).join('');

  const total = postedItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;margin:0 auto;background:#fff;">
      <div style="padding:20px 24px;background:#059669;color:#fff;border-radius:12px 12px 0 0;">
        <h2 style="margin:0;font-size:18px;">FlowFin · Resumen de domiciliados</h2>
        <p style="margin:4px 0 0;font-size:13px;opacity:.9;">${todayIso()} — Periodo ${month}</p>
      </div>
      <div style="padding:20px 24px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;">
        <p style="font-size:14px;color:#333;margin:0 0 12px;">
          Hoy se procesaron <b>${postedItems.length}</b> movimientos domiciliados en
          <b>${families.size}</b> familia(s). Total: <b>${formatCurrency(total)}</b>.
        </p>
        ${postedItems.length === 0 ? `
          <p style="font-size:13px;color:#666;">No se registraron movimientos automáticos hoy.</p>
        ` : `
          <table style="width:100%;border-collapse:collapse;margin-top:8px;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:left;color:#666;">Familia</th>
                <th style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:left;color:#666;">Movimiento</th>
                <th style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:right;color:#666;">Monto</th>
                <th style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:left;color:#666;">Tipo</th>
                <th style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:left;color:#666;">Estado</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `}
        <p style="font-size:11px;color:#999;margin-top:16px;">
          Este es un resumen automático del autopost diario. Los movimientos se crean idempotentemente (scheduled_payment_id + mes).
        </p>
      </div>
    </div>
  `;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const denied = await guardInternal(base44, req);
    if (denied) return denied;


    const month = currentMonth();
    const today = new Date();
    const activeScheduledPayments = await base44.asServiceRole.entities.ScheduledPayment.filter({
      is_active: true,
      automation_mode: 'auto',
      autopost_enabled: true,
    });

    let createdRecords = 0;
    let updatedRecords = 0;
    let createdTransactions = 0;
    const postedItems = []; // for email summary
    const familyNameCache = new Map();

    for (const scheduledPayment of activeScheduledPayments || []) {
      const dueDay = Number(scheduledPayment.due_day || 1);
      const tolerance = Math.max(0, Math.min(3, Number(scheduledPayment.autopost_day_tolerance || 0)));
      if (today.getDate() + tolerance < dueDay) continue;

      const existingRecords = await base44.asServiceRole.entities.ScheduledPaymentRecord.filter({
        scheduled_payment_id: scheduledPayment.id,
        month,
      });

      const baseRecord = {
        family_id: scheduledPayment.family_id,
        month,
        paid_date: todayIso(),
        amount_paid: Number(scheduledPayment.amount || 0),
        notes: `Autopost ${month}${scheduledPayment.match_hint ? ` · hint:${scheduledPayment.match_hint}` : ''}`,
        paid_by: 'Sistema (auto)',
      };

      let record = existingRecords?.[0];
      let recordStatus = 'sin cambios';
      if (!record) {
        record = await base44.asServiceRole.entities.ScheduledPaymentRecord.create({
          ...baseRecord,
          scheduled_payment_id: scheduledPayment.id,
        });
        createdRecords += 1;
        recordStatus = 'creado';
      } else {
        record = await base44.asServiceRole.entities.ScheduledPaymentRecord.update(record.id, baseRecord);
        updatedRecords += 1;
        recordStatus = 'actualizado';
      }

      // Resolve family name (cached)
      let familyName = familyNameCache.get(scheduledPayment.family_id);
      if (!familyName) {
        try {
          const fam = await base44.asServiceRole.entities.Family.get(scheduledPayment.family_id);
          familyName = fam?.name || scheduledPayment.family_id;
        } catch {
          familyName = scheduledPayment.family_id;
        }
        familyNameCache.set(scheduledPayment.family_id, familyName);
      }

      const tx = await base44.asServiceRole.entities.Transaction.filter({ scheduled_payment_record_id: record.id });
      let txStatus = 'transacción existente';
      if (!tx?.length) {
        // Prefer the configured person; fall back to first person of the family
        let personId = scheduledPayment.person_id;
        if (!personId) {
          const persons = await base44.asServiceRole.entities.Person.filter({ family_id: scheduledPayment.family_id });
          personId = persons?.[0]?.id;
        }
        if (!scheduledPayment.category_id || !personId || !scheduledPayment.payment_method_id) {
          postedItems.push({
            familyName,
            name: scheduledPayment.name,
            icon: scheduledPayment.icon,
            amount: baseRecord.amount_paid,
            type: scheduledPayment.type || 'expense',
            status: `⚠️ registro ${recordStatus}, faltan datos para crear transacción`,
          });
          continue;
        }

        await base44.asServiceRole.entities.Transaction.create({
          family_id: scheduledPayment.family_id,
          date: baseRecord.paid_date,
          type: scheduledPayment.type === 'income' ? 'income' : 'expense',
          amount: baseRecord.amount_paid,
          description: `${scheduledPayment.icon || '📅'} ${scheduledPayment.name}`,
          category_id: scheduledPayment.category_id,
          person_id: personId,
          payment_method_id: scheduledPayment.payment_method_id,
          notes: `Creado automáticamente (${month})`,
          scheduled_payment_record_id: record.id,
        });
        createdTransactions += 1;
        txStatus = '✅ transacción creada';
      }

      postedItems.push({
        familyName,
        name: scheduledPayment.name,
        icon: scheduledPayment.icon,
        amount: baseRecord.amount_paid,
        type: scheduledPayment.type || 'expense',
        status: `${recordStatus} · ${txStatus}`,
      });
    }

    // Send summary email to APP_OWNER_EMAIL (best-effort, never blocks autopost)
    const ownerEmail = Deno.env.get('APP_OWNER_EMAIL');
    let emailSent = false;
    let emailError = null;
    if (ownerEmail) {
      try {
        const families = new Set(postedItems.map(i => i.familyName));
        const html = buildSummaryHtml({ month, postedItems, families });
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: 'FlowFin Auto',
          to: ownerEmail,
          subject: `FlowFin · Autopost diario ${todayIso()} — ${postedItems.length} movimientos`,
          body: html,
        });
        emailSent = true;
      } catch (err) {
        emailError = err?.message || String(err);
        console.error('[autoPostScheduledPayments] email error:', emailError);
      }
    }

    return Response.json({
      ok: true,
      month,
      createdRecords,
      updatedRecords,
      createdTransactions,
      emailSent,
      emailError,
      idempotency_key: 'scheduled_payment_id+month',
    });
  } catch (error) {
    console.error('[autoPostScheduledPayments]', error);
    return Response.json({ error: error.message || 'internal' }, { status: 500 });
  }
});