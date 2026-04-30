export async function getExchangeRate(date, from, to) {
  if (from === to) return 1;
  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?from=${from}&to=${to}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.rates?.[to] ?? null;
  } catch {
    return null;
  }
}
