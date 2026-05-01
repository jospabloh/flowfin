/**
 * Fetches exchange rate for a given currency pair.
 * Uses open.er-api.com (free, no key, supports MXN and 160+ currencies).
 */
export async function getExchangeRate(date, from, to) {
  if (from === to) return 1;

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.result === 'success' && data.rates?.[to]) {
        return data.rates[to];
      }
    }
  } catch {
    // fall through to backup
  }

  // Fallback: cross via USD if from !== USD
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/USD`);
    if (res.ok) {
      const data = await res.json();
      if (data?.result === 'success') {
        const rateFrom = data.rates[from];
        const rateTo = data.rates[to];
        if (rateFrom && rateTo) return rateTo / rateFrom;
      }
    }
  } catch {
    // give up
  }

  return null;
}