/**
 * Fetches exchange rate for a given date and currency pair.
 * Uses exchangerate.host as primary (supports MXN), falls back to Frankfurter.
 */
export async function getExchangeRate(date, from, to) {
  if (from === to) return 1;

  // Primary: exchangerate.host (supports MXN and most currencies)
  try {
    const res = await fetch(
      `https://api.exchangerate.host/convert?from=${from}&to=${to}&date=${date}&amount=1`
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.result) return data.result;
    }
  } catch {
    // fall through to backup
  }

  // Fallback: Frankfurter (EUR-based, limited pairs)
  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?from=${from}&to=${to}`);
    if (res.ok) {
      const data = await res.json();
      const rate = data.rates?.[to];
      if (rate) return rate;
    }
  } catch {
    // fall through
  }

  // Second fallback: try inverting via EUR as bridge
  try {
    const [resFrom, resTo] = await Promise.all([
      fetch(`https://api.frankfurter.app/${date}?from=EUR&to=${from}`),
      fetch(`https://api.frankfurter.app/${date}?from=EUR&to=${to}`),
    ]);
    if (resFrom.ok && resTo.ok) {
      const [dFrom, dTo] = await Promise.all([resFrom.json(), resTo.json()]);
      const rateFrom = dFrom.rates?.[from];
      const rateTo = dTo.rates?.[to];
      if (rateFrom && rateTo) return rateTo / rateFrom;
    }
  } catch {
    // give up
  }

  return null;
}