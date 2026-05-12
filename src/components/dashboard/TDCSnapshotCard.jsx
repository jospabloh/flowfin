import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { formatCurrency, todayISO } from '@/lib/formatters';
import { Pencil, AlertTriangle, X, Check } from 'lucide-react';

function daysBetween(dateA, dateB) {
  const a = new Date(dateA + 'T12:00:00');
  const b = new Date(dateB + 'T12:00:00');
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function formatSnapshotDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function EditModal({ card, snapshot, onClose, onSaved, familyId }) {
  const [balance, setBalance] = useState(snapshot ? String(snapshot.balance) : '');
  const [amountDue, setAmountDue] = useState(snapshot?.amount_due != null ? String(snapshot.amount_due) : '');
  const [cutDay, setCutDay] = useState(card?.cut_day != null ? String(card.cut_day) : '');
  const [paymentDay, setPaymentDay] = useState(card?.payment_day != null ? String(card.payment_day) : '');
  const [notes, setNotes] = useState(snapshot?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const val = parseFloat(balance);
    if (isNaN(val)) return;
    const parsedAmountDue = amountDue === '' ? null : parseFloat(amountDue);
    if (amountDue !== '' && isNaN(parsedAmountDue)) return;
    const parsedCutDay = cutDay === '' ? null : parseInt(cutDay, 10);
    if (cutDay !== '' && (isNaN(parsedCutDay) || parsedCutDay < 1 || parsedCutDay > 31)) return;
    const parsedPaymentDay = paymentDay === '' ? null : parseInt(paymentDay, 10);
    if (paymentDay !== '' && (isNaN(parsedPaymentDay) || parsedPaymentDay < 1 || parsedPaymentDay > 31)) return;

    setSaving(true);
    try {
      await Promise.all([
        base44.entities.CreditCardSnapshot.create({
          family_id: familyId,
          payment_method_id: card.id,
          balance: val,
          amount_due: parsedAmountDue,
          snapshot_date: todayISO(),
          notes: notes || undefined,
        }),
        base44.entities.PaymentMethod.update(card.id, {
          cut_day: parsedCutDay,
          payment_day: parsedPaymentDay,
        }),
      ]);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
      <div className="bg-card rounded-3xl border border-border w-full max-w-sm p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground text-base">Actualizar saldo</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{card.name}{card.bank ? ` · ${card.bank}` : ''}{card.identifier ? ` ···${card.identifier}` : ''}</p>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Saldo actual</label>
          <div className="flex items-baseline gap-1 bg-muted rounded-xl px-4 py-3 border border-border focus-within:ring-2 focus-within:ring-primary/30">
            <span className="text-lg font-light text-muted-foreground">$</span>
            <input
              type="number"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              autoFocus
              className="flex-1 text-2xl font-bold bg-transparent border-none outline-none text-foreground placeholder-muted-foreground/30"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Saldo por pagar (opcional)</label>
          <div className="flex items-baseline gap-1 bg-muted rounded-xl px-4 py-3 border border-border focus-within:ring-2 focus-within:ring-primary/30">
            <span className="text-lg font-light text-muted-foreground">$</span>
            <input
              type="number"
              value={amountDue}
              onChange={e => setAmountDue(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="flex-1 text-lg font-semibold bg-transparent border-none outline-none text-foreground placeholder-muted-foreground/30"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Día de corte (1-31)</label>
            <input
              type="number"
              min="1"
              max="31"
              step="1"
              value={cutDay}
              onChange={e => setCutDay(e.target.value)}
              placeholder="Ej. 15"
              className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Día de pago (1-31)</label>
            <input
              type="number"
              min="1"
              max="31"
              step="1"
              value={paymentDay}
              onChange={e => setPaymentDay(e.target.value)}
              placeholder="Ej. 05"
              className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Notas (opcional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Corte del 15, etc."
            className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !balance}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar saldo'}
        </button>
      </div>
    </div>
  );
}

export default function TDCSnapshotCard() {
  const { familyId, currency, familyConfig } = useFamily();
  const locale = familyConfig?.locale || 'es-MX';
  const [creditCards, setCreditCards] = useState([]);
  const [snapshots, setSnapshots] = useState({});
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async (attempt = 0) => {
    if (!familyId) return;
    try {
      const methods = await base44.entities.PaymentMethod.filter({ family_id: familyId });
      const cards = methods.filter(m => m.type === 'credit');
      setCreditCards(cards);

      if (cards.length === 0) {
        setLoading(false);
        return;
      }

      // Small gap between the two sequential calls
      await new Promise(r => setTimeout(r, 500));

      const snaps = await base44.entities.CreditCardSnapshot.filter({ family_id: familyId });

      const latestMap = {};
      for (const s of snaps) {
        const prev = latestMap[s.payment_method_id];
        if (!prev || s.snapshot_date > prev.snapshot_date) {
          latestMap[s.payment_method_id] = s;
        }
      }
      setSnapshots(latestMap);
    } catch (_err) {
      // Retry with exponential backoff on rate limit (max 3 retries)
      if (attempt < 3) {
        const delay = (attempt + 1) * 4000;
        setTimeout(() => load(attempt + 1), delay);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  // Large initial delay so Dashboard's primary queries finish first
  useEffect(() => {
    if (!familyId) return;
    const t = setTimeout(() => load(), 8000);
    return () => clearTimeout(t);
  }, [familyId]);

  if (loading || creditCards.length === 0) return null;

  const today = todayISO();

  return (
    <>
      <div className="px-4 mt-4 mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-2">Tarjetas de Crédito</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {creditCards.map(card => {
            const snap = snapshots[card.id];
            const isStale = snap ? daysBetween(snap.snapshot_date, today) > 7 : true;
            return (
              <div
                key={card.id}
                className="bg-card border border-border rounded-2xl p-4 flex items-start justify-between gap-3 shadow-sm"
                style={{ borderLeftWidth: 3, borderLeftColor: '#D4AF37' }}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{card.name}</p>
                  {card.bank && (
                    <p className="text-xs text-muted-foreground truncate">{card.bank}{card.identifier ? ` ···${card.identifier}` : ''}</p>
                  )}
                  {snap ? (
                    <>
                      <p className="text-[11px] text-muted-foreground mt-1">Saldo total</p>
                      <p className="text-xl font-black text-foreground">
                        {formatCurrency(snap.balance, { locale, currency, decimals: 2 })}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Saldo por pagar</p>
                      <p className="text-sm font-semibold text-foreground">
                        {snap.amount_due != null
                          ? formatCurrency(snap.amount_due, { locale, currency, decimals: 2 })
                          : <span className="text-muted-foreground italic font-normal">Sin registrar</span>}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2">
                        <p className="text-[11px]"><span className="text-muted-foreground">Fecha de corte: </span><span className="text-foreground">{card.cut_day != null ? `Día ${card.cut_day}` : 'Sin registrar'}</span></p>
                        <p className="text-[11px]"><span className="text-muted-foreground">Fecha de pago: </span><span className="text-foreground">{card.payment_day != null ? `Día ${card.payment_day}` : 'Sin registrar'}</span></p>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Actualizado {formatSnapshotDate(snap.snapshot_date)}
                        {isStale && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-semibold">
                            <AlertTriangle className="w-3 h-3" /> Actualizar
                          </span>
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground mt-1 italic">Sin saldo registrado</p>
                      <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 text-[11px] font-semibold mt-0.5">
                        <AlertTriangle className="w-3 h-3" /> Actualizar
                      </span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setEditing(card)}
                  aria-label={`Editar saldo de ${card.name}`}
                  className="flex-shrink-0 p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <EditModal
          card={editing}
          snapshot={snapshots[editing.id]}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          familyId={familyId}
          currency={currency}
          locale={locale}
        />
      )}
    </>
  );
}
