/**
 * Rule-based category matcher — ZERO AI credits at runtime.
 * Uses keyword matching + usage frequency scoring.
 */

function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

export function matchCategory(text, subcategories, categories, usageStats = {}) {
  if (!text || text.trim().length < 2) return [];

  const words = normalize(text).split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return [];

  const results = [];

  for (const sub of subcategories) {
    const keywords = (sub.keywords || []).map(normalize);
    if (keywords.length === 0) continue;

    let score = 0;
    for (const word of words) {
      for (const kw of keywords) {
        if (word === kw) { score += 20; break; }
        if (kw.startsWith(word) || word.startsWith(kw)) { score += 12; break; }
        if (kw.includes(word) || word.includes(kw)) { score += 6; break; }
      }
    }

    if (score === 0) continue;

    const usageBonus = Math.min((usageStats[sub.id] || 0) * 1.5, 30);
    score += usageBonus;

    const category = categories.find(c => c.id === sub.category_id);
    results.push({ subcategory: sub, category, score });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 6);
}

export function parseVoiceText(text) {
  if (!text) return { amount: null, description: text };

  // Try numeric first
  const numMatch = text.match(/(\d[\d,.]*)(\s*(pesos?|mxn|dlls?|\$))?/i);
  if (numMatch) {
    const amount = parseFloat(numMatch[1].replace(',', ''));
    const description = text
      .replace(numMatch[0], '')
      .replace(/pesos?|mxn|dlls?/gi, '')
      .trim();
    return { amount: isNaN(amount) ? null : amount, description };
  }

  // Word-based numbers (Spanish)
  const wordMap = {
    'cien': 100, 'ciento': 100, 'doscientos': 200, 'trescientos': 300,
    'cuatrocientos': 400, 'quinientos': 500, 'seiscientos': 600,
    'setecientos': 700, 'ochocientos': 800, 'novecientos': 900,
    'mil': 1000, 'dos mil': 2000, 'tres mil': 3000, 'cinco mil': 5000,
    'diez mil': 10000, 'veinte': 20, 'treinta': 30, 'cuarenta': 40,
    'cincuenta': 50, 'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90,
  };

  const lower = text.toLowerCase();
  for (const [word, value] of Object.entries(wordMap).sort((a, b) => b[1] - a[1])) {
    if (lower.includes(word)) {
      const description = lower.replace(word, '').replace(/pesos?|mxn/g, '').trim();
      return { amount: value, description };
    }
  }

  return { amount: null, description: text };
}

export function getWeekNumber(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date - start) / 86400000 + start.getDay() + 1) / 7);
}