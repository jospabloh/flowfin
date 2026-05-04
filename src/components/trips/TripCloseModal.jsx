import { useState } from 'react';
import { X, Download, FileArchive, AlertTriangle, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useToast } from '@/components/ui/use-toast';

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
}

function buildCSV(transactions, categories, paymentMethods) {
  const header = 'fecha,descripcion,categoria,monto_original,moneda_original,tipo_cambio,monto_familia,forma_pago,notas';
  const rows = transactions.map(t => {
    const cat = categories.find(c => c.id === t.category_id);
    const pm = paymentMethods.find(m => m.id === t.payment_method_id);
    return [
      t.date || '',
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${cat?.name || ''}"`,
      t.original_amount ?? t.amount ?? '',
      t.original_currency || '',
      t.exchange_rate || '',
      t.amount || '',
      `"${pm?.name || ''}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

function downloadCSV(content, filename) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function downloadZIP(tripName, transactions, categories, paymentMethods) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const csv = buildCSV(transactions, categories, paymentMethods);
  zip.file('gastos.csv', '﻿' + csv);
  const receipts = zip.folder('recibos');
  for (const t of transactions) {
    if (t.receipt_image) {
      try {
        const res = await fetch(t.receipt_image);
        const blob = await res.blob();
        const ext = blob.type.includes('png') ? 'png' : 'jpg';
        receipts.file(`${t.date}_${slugify(t.description)}.${ext}`, blob);
      } catch { /* receipt fetch failed — skip */ }
    }
  }
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url; a.download = `${slugify(tripName)}_gastos.zip`; a.click();
  URL.revokeObjectURL(url);
}

export default function TripCloseModal({ trip, transactions, categories, paymentMethods, onClose, onClosed }) {
  const { currency: familyCurrency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const { toast } = useToast();
  const [screen, setScreen] = useState('summary'); // 'summary' | 'export'
  const [closing, setClosing] = useState(false);
  const [exporting, setExporting] = useState(null);

  const expenses = transactions.filter(t => t.type === 'expense');
  const totalSpent = expenses.reduce((s, t) => s + (t.amount || 0), 0);
  const duration = (() => {
    const s = new Date(trip.start_date + 'T12:00:00');
    const e = new Date(trip.end_date + 'T12:00:00');
    return Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
  })();

  const byCurrency = (() => {
    const m = {};
    for (const t of expenses) {
      const cur = t.original_currency || familyCurrency;
      const amt = t.original_amount || t.amount || 0;
      m[cur] = (m[cur] || 0) + amt;
    }
    return Object.entries(m);
  })();

  const topCats = (() => {
    const m = {};
    for (const t of expenses) {
      const cat = categories.find(c => c.id === t.category_id);
      const name = cat ? `${cat.icon || ''} ${cat.name}` : 'Sin rubro';
      m[name] = (m[name] || 0) + (t.amount || 0);
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3);
  })();

  const hasImages = transactions.some(t => t.receipt_image);

  const handleClose = async () => {
    setClosing(true);
    try {
      // 1. Update trip status
      await base44.entities.Trip.update(trip.id, {
        status: 'closed',
        closed_at: new Date().toISOString(),
      });

      // 2. Tag all transactions and clear receipt images
      for (const t of transactions) {
        const update = {
          notes: `${t.notes ? t.notes + ' ' : ''}[Viaje: ${trip.name}]`,
        };
        if (t.receipt_image) update.receipt_image = null;
        await base44.entities.Transaction.update(t.id, update);
      }

      toast({ title: 'Viaje cerrado. Los gastos quedaron en tus movimientos.' });
      onClosed();
    } catch (err) {
      toast({ title: 'Error al cerrar el viaje', description: err?.message || '', variant: 'destructive' });
    } finally {
      setClosing(false);
    }
  };

  if (screen === 'summary') {
    return (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50">
        <div className="bg-card rounded-t-3xl sm:rounded-3xl border border-border w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <h2 className="font-bold text-foreground text-base">Resumen del Viaje</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-muted text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
              <p className="font-bold text-foreground">{trip.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(trip.start_date, { locale })} — {formatDate(trip.end_date, { locale })} · {duration} días
              </p>
              {trip.destination_countries?.length > 0 && (
                <p className="text-xs text-muted-foreground">{trip.destination_countries.join(', ')}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-foreground">{expenses.length}</p>
                <p className="text-xs text-muted-foreground">Gastos</p>
              </div>
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-lg font-black text-foreground">
                  {formatCurrency(totalSpent, { locale, currency: familyCurrency, decimals: 0 })}
                </p>
                <p className="text-xs text-muted-foreground">Total gastado</p>
              </div>
            </div>

            {byCurrency.length > 1 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Por moneda</p>
                <div className="space-y-1.5">
                  {byCurrency.map(([cur, total]) => (
                    <div key={cur} className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg text-sm">
                      <span className="font-mono text-muted-foreground">{cur}</span>
                      <span className="font-bold text-foreground">{formatCurrency(total, { locale, currency: cur, decimals: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {topCats.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Top categorías</p>
                <div className="space-y-1.5">
                  {topCats.map(([name, total]) => (
                    <div key={name} className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg text-sm">
                      <span className="text-foreground">{name}</span>
                      <span className="font-bold">{formatCurrency(total, { locale, currency: familyCurrency, decimals: 0 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {transactions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Todos los gastos</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {transactions.map(t => {
                    const cat = categories.find(c => c.id === t.category_id);
                    return (
                      <div key={t.id} className="flex items-center justify-between px-3 py-1.5 bg-muted rounded-lg text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span>{cat?.icon || '📋'}</span>
                          <span className="truncate text-foreground">{t.description || cat?.name || '—'}</span>
                          <span className="text-muted-foreground flex-shrink-0">· {t.date}</span>
                          {t.receipt_image && <span title="Tiene recibo" className="flex-shrink-0">📎</span>}
                        </div>
                        <span className={`font-bold flex-shrink-0 ml-2 ${t.type === 'expense' ? 'text-expense' : 'text-income'}`}>
                          {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount, { locale, currency: familyCurrency, decimals: 0 })}
                          {t.exchange_rate && t.original_currency !== familyCurrency
                            ? ` (TC:${t.exchange_rate})`
                            : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-border flex-shrink-0 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground">
              Cancelar
            </button>
            <button
              onClick={() => setScreen('export')}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Export screen
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-card rounded-t-3xl sm:rounded-3xl border border-border w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-foreground text-base">¿Descargar respaldo?</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Las imágenes de recibos serán eliminadas permanentemente al cerrar el viaje. Solo quedará el registro en tus movimientos.
            </p>
          </div>

          <button
            disabled={exporting === 'csv'}
            onClick={() => {
              setExporting('csv');
              try { downloadCSV(buildCSV(transactions, categories, paymentMethods), `${slugify(trip.name)}_gastos.csv`); }
              finally { setExporting(null); }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting === 'csv' ? 'Descargando...' : 'Descargar CSV'}
          </button>

          {hasImages && (
            <button
              disabled={exporting === 'zip'}
              onClick={async () => {
                setExporting('zip');
                try { await downloadZIP(trip.name, transactions, categories, paymentMethods); }
                finally { setExporting(null); }
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <FileArchive className="w-4 h-4" />
              {exporting === 'zip' ? 'Generando ZIP...' : 'Descargar ZIP (con imágenes)'}
            </button>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground">
            Cancelar
          </button>
          <button
            onClick={handleClose}
            disabled={closing}
            className="flex-1 py-3 rounded-xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {closing ? (
              <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Cerrando...</>
            ) : (
              <><Check className="w-4 h-4" />Cerrar sin descargar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
