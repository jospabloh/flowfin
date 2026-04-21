// Maps common merchant name variants (OCR noise, typos, abbreviations) to canonical names.
// Normalized keys are compared case-insensitively after removing punctuation/accents.

const MERCHANT_MAP = [
  [/\bwal[\s-]?mart\b/, 'Walmart'],
  [/\bwalmart\s*(super|express|neighborhood)?\b/, 'Walmart'],
  [/\bsamclub\b|\bsam['']s\s*club\b/, "Sam's Club"],
  [/\boxxo\b/, 'OXXO'],
  [/\bcircle\s*k\b/, 'Circle K'],
  [/\b7[\s-]?eleven\b/, '7-Eleven'],
  [/\bsoriana\b/, 'Soriana'],
  [/\bchedraui\b/, 'Chedraui'],
  [/\bla\s*comer\b/, 'La Comer'],
  [/\bcostco\b/, 'Costco'],
  [/\bheb\b/, 'HEB'],
  [/\bcomercial\s*mexicana\b|\bci\s*banco\b/, 'Comercial Mexicana'],
  [/\blivepool\b|\bliverpool\b/, 'Liverpool'],
  [/\bpalacio\s*(de\s*hierro)?\b/, 'El Palacio de Hierro'],
  [/\bprix\b|\bpricex\b/, 'PriceSmart'],
  [/\bubereats\b|\buber\s*eats\b/, 'Uber Eats'],
  [/\buber\b/, 'Uber'],
  [/\bdidi\b/, 'DiDi'],
  [/\bcabify\b/, 'Cabify'],
  [/\brappi\b/, 'Rappi'],
  [/\bstarbucks\b|\bsbux\b/, 'Starbucks'],
  [/\bmcdonalds?\b|\bmc\s*d['']s\b/, "McDonald's"],
  [/\bburger\s*king\b/, 'Burger King'],
  [/\bdominos?\s*(pizza)?\b/, "Domino's"],
  [/\bpizza\s*hut\b/, 'Pizza Hut'],
  [/\bkfc\b/, 'KFC'],
  [/\bsubway\b/, 'Subway'],
  [/\bcinepolis\b/, 'Cinépolis'],
  [/\bcinemex\b/, 'Cinemex'],
  [/\bpemex\b/, 'PEMEX'],
  [/\bshell\b/, 'Shell'],
  [/\bita?lika\b|\bitali?ka\b/, 'Italika'],
  [/\btelcel\b/, 'Telcel'],
  [/\bat&?\s*t\b/, 'AT&T'],
  [/\btelmex\b/, 'Telmex'],
  [/\bamazon\b/, 'Amazon'],
  [/\bmercado\s*libre\b/, 'Mercado Libre'],
  [/\bnetflix\b/, 'Netflix'],
  [/\bspotify\b/, 'Spotify'],
  [/\bamazon\s*prime\b/, 'Amazon Prime'],
  [/\bapple\b/, 'Apple'],
  [/\bgoogle\b/, 'Google'],
  [/\bfacebook\b|\bmeta\b/, 'Meta'],
  [/\bbbva\b|\bbbva\s*bancomer\b/, 'BBVA'],
  [/\bbanorte\b/, 'Banorte'],
  [/\bbanamex\b|\bcitibanamex\b/, 'Citibanamex'],
  [/\bsantander\b/, 'Santander'],
  [/\bhsbc\b/, 'HSBC'],
  [/\bscotiabank\b/, 'Scotiabank'],
  [/\binbursa\b/, 'Inbursa'],
  [/\bclip\b/, 'Clip'],
  [/\bmercado\s*pago\b/, 'Mercado Pago'],
];

function prepare(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s'&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns the canonical merchant name for the given text, or null if no match.
 * Case-insensitive; strips accents and punctuation before matching.
 */
export function normalize(text) {
  if (!text || text.length < 2) return null;
  const prepared = prepare(text);
  for (const [pattern, canonical] of MERCHANT_MAP) {
    if (pattern.test(prepared)) return canonical;
  }
  return null;
}
