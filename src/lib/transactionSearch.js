// Free-text search for Movimientos. Matches concepto, monto, fecha, tipo,
// forma de pago, quién, rubro y subrubro. Every word typed must match
// somewhere ("gasto pablo" = gastos de Pablo), case- and accent-insensitive.

const normalize = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const nameOf = (list, id) => (id && (list || []).find(x => x.id === id)?.name) || '';

function amountTokens(amount) {
  if (amount == null || amount === '' || isNaN(Number(amount))) return [];
  const n = Number(amount);
  // "1300", "1300.00", "1,300.00" all find the same movement.
  return [String(n), n.toFixed(2), n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })];
}

function dateTokens(date) {
  if (!date) return [];
  const [y, m, d] = String(date).slice(0, 10).split('-');
  if (!y || !m || !d) return [String(date)];
  // ISO as stored, plus dd/mm/yyyy as it is read in México.
  return [`${y}-${m}-${d}`, `${d}/${m}/${y}`, `${Number(d)}/${Number(m)}/${y}`];
}

const TYPE_WORDS = { expense: 'gasto egreso', income: 'ingreso' };

export function buildTransactionMatcher(query, { categories, subcategories, persons, paymentMethods } = {}) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return () => true;
  return (t) => {
    const haystack = normalize([
      t.description || '',
      nameOf(categories, t.category_id),
      nameOf(subcategories, t.subcategory_id),
      nameOf(persons, t.person_id),
      nameOf(paymentMethods, t.payment_method_id),
      TYPE_WORDS[t.type] || '',
      ...amountTokens(t.amount),
      ...dateTokens(t.date),
    ].join(' | '));
    return terms.every(term => haystack.includes(term));
  };
}
