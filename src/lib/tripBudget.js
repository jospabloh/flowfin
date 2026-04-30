/**
 * Computes how much has been spent on a trip, expressed in the trip's
 * `budget_currency`, so the value can be compared against `budget_amount`
 * without mixing currencies.
 *
 * Each transaction stores `amount` in the family currency and, when the
 * expense was captured in a foreign currency, also stores `original_amount`
 * + `original_currency` + `exchange_rate` (rate = original → family).
 *
 * Per-expense rules, in order:
 *  1. `original_currency === budgetCurrency`        → use `original_amount` (exact).
 *  2. `budgetCurrency === familyCurrency`           → use `amount` (already in family currency).
 *  3. Inferred family→budget rate available         → use `amount × inferredRate`.
 *  4. Otherwise                                     → mark as unconverted.
 *
 * The inferred rate is taken from the most recent expense whose
 * `original_currency === budgetCurrency` (so its `1 / exchange_rate`
 * is a known family→budget factor). This avoids any network call.
 */
export function computeTripSpent(transactions, trip, familyCurrency) {
  const budgetCurrency = trip?.budget_currency || familyCurrency;
  const tripExpenses = (transactions || []).filter(
    t => t.trip_id === trip?.id && t.type === 'expense'
  );

  const inferredFamilyToBudget = inferFamilyToBudgetRate(
    tripExpenses,
    budgetCurrency,
    familyCurrency
  );

  let spent = 0;
  let unconvertedCount = 0;

  for (const t of tripExpenses) {
    const originalAmount = Number(t.original_amount) || 0;
    const amount = Number(t.amount) || 0;

    if (t.original_currency === budgetCurrency && originalAmount > 0) {
      spent += originalAmount;
    } else if (budgetCurrency === familyCurrency) {
      spent += amount;
    } else if (inferredFamilyToBudget && amount > 0) {
      spent += amount * inferredFamilyToBudget;
    } else if (amount > 0) {
      unconvertedCount += 1;
    }
  }

  return { spent, budgetCurrency, unconvertedCount };
}

function inferFamilyToBudgetRate(expenses, budgetCurrency, familyCurrency) {
  if (budgetCurrency === familyCurrency) return 1;
  const sorted = [...expenses].sort((a, b) =>
    (b.date || '').localeCompare(a.date || '')
  );
  for (const t of sorted) {
    if (
      t.original_currency === budgetCurrency &&
      Number(t.exchange_rate) > 0
    ) {
      return 1 / Number(t.exchange_rate);
    }
  }
  return null;
}
