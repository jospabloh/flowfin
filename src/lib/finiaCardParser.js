/**
 * Structured-signal parsing for Finia's chat replies.
 *
 * Finia's replies are free text, but for a handful of well-known moments
 * (transaction draft, duplicate warning) the agent is instructed to lay out
 * a fixed set of labeled fields (Monto, Tipo, Concepto, Rubro, Persona,
 * Forma de pago, Fecha). In production the model renders that layout either
 * as a bullet list ("— Monto: $850") or as a GFM table ("| Monto | $850 |")
 * — the exact shape isn't guaranteed, only the labels are.
 *
 * Everything here works off those labels rather than sniffing arbitrary
 * prose (e.g. "el mensaje contiene la palabra 'error'"), which is what made
 * the previous "smart" cards misfire: a message that just happened to
 * mention "¿de quién fue?" as one bullet among six got read as a single
 * yes/no question about the person (see FiniaQuickChips's old detectIntent).
 * Field-label matching is much harder to fool by accident.
 */

// Canonical field keys we know how to extract, mapped to the label variants
// Finia actually uses (accumulated from production replies — bullets, tables,
// with/without accents, singular/plural).
// Order matters: subcategory must be tested before category so a plain
// substring engine wouldn't misread "Subrubro" as "Rubro" — the \b word
// boundaries below already prevent that ("rubro" has no boundary right
// after "Sub"), but keeping the more specific pattern first is cheap
// insurance against future edits loosening the regex.
const FIELD_PATTERNS = {
  amount: /\b(monto|cantidad)\b/i,
  type: /^tipo$/i,
  concept: /\b(concepto|descripci[oó]n)\b/i,
  subcategory: /\b(subrubro|subcategor[ií]a)\b/i,
  category: /\b(rubro|categor[ií]a)\b/i,
  person: /\b(persona|integrante)\b/i,
  paymentMethod: /forma de pago|m[eé]todo de pago/i,
  date: /\bfecha\b/i,
};

// Any codepoint that can appear as part of an emoji glyph or bullet marker:
// pictographs, emoji-presentation symbols, variation selectors (U+FE0F —
// left behind by e.g. "✉️" once the base ENVELOPE char is stripped, which
// otherwise silently breaks the `type` field's exact-match pattern above),
// and zero-width joiners used in compound emoji.
const EMOJI_CHARS = /[\p{Emoji_Presentation}\p{Extended_Pictographic}️︎‍]/gu;

// Strips markdown bold/italic markers, leading bullet glyphs, and emoji so
// "— 💰 **Monto**" and "✉️ Tipo" both reduce to "Monto"/"Tipo".
function cleanLabel(raw) {
  return raw
    .replace(EMOJI_CHARS, '')
    .replace(/\*\*/g, '')
    .replace(/^[-—•*\s]+/, '')
    .trim();
}

function cleanValue(raw) {
  return raw
    .replace(/\*\*/g, '')
    .replace(/\|/g, '')
    .trim();
}

/**
 * Extracts a { fieldKey: value } map from message content, regardless of
 * whether Finia formatted the fields as a bullet list or a markdown table.
 * Unrecognized labels are ignored; recognized labels keep their last value.
 */
export function extractLabeledFields(content) {
  if (!content) return {};
  const fields = {};

  const registerLine = (label, value) => {
    const cleanedLabel = cleanLabel(label);
    const cleanedValue = cleanValue(value);
    if (!cleanedLabel || !cleanedValue) return;
    for (const [key, pattern] of Object.entries(FIELD_PATTERNS)) {
      if (pattern.test(cleanedLabel)) {
        fields[key] = cleanedValue;
        break;
      }
    }
  };

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Table row: "| 💰 **Monto** | $104.50 |" — may hold several
    // label/value pairs mashed onto one line (the garbled-table case).
    if (trimmed.includes('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      // Table rows come in label/value pairs; walk two cells at a time.
      for (let i = 0; i + 1 < cells.length; i += 2) {
        // Skip GFM header separator cells like "-------"
        if (/^-+$/.test(cells[i]) || /^-+$/.test(cells[i + 1])) continue;
        registerLine(cells[i], cells[i + 1]);
      }
      continue;
    }

    // Bullet line: "— Monto: $850" / "- Monto: $850" / "💰 Monto: $850"
    const bulletMatch = trimmed.match(/^[-—•*\s]*(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*)?([^:]+):\s*(.+)$/u);
    if (bulletMatch) {
      registerLine(bulletMatch[1], bulletMatch[2]);
    }
  }

  return fields;
}

// A message counts as a "structured field dump" once it lays out at least
// this many recognized fields — one or two incidental colons in normal
// prose ("Nota: revisa tu presupuesto") shouldn't trigger it.
const MIN_FIELDS_FOR_STRUCTURED_MESSAGE = 3;

/**
 * Counts how many distinct known fields (Monto, Concepto, Rubro, ...) are
 * called out as **bold** labels anywhere in the message, even without a
 * "Label: value" shape — e.g. Finia asking "**Monto** (¿cuánto?)" for each
 * field it still needs. Used to tell "asking about several fields at once"
 * apart from "asking one specific yes/no question about a single field",
 * which single-field intent detectors (ask_person, ask_category, ...) can
 * otherwise misread — a bolded "**Persona** (¿de quién fue?)" bullet inside
 * a six-field checklist isn't a standalone question about the person.
 */
export function countKnownFieldLabelMentions(content) {
  if (!content) return 0;
  const bolded = content.match(/\*\*([^*]+)\*\*/g) || [];
  const matched = new Set();
  for (const raw of bolded) {
    const label = cleanLabel(raw);
    for (const [key, pattern] of Object.entries(FIELD_PATTERNS)) {
      if (pattern.test(label)) { matched.add(key); break; }
    }
  }
  return matched.size;
}

/**
 * Detects a transaction-draft moment: Finia laid out draft fields and is
 * asking the user to confirm before saving.
 * Returns the parsed fields plus the confirmation question, or null.
 */
export function parseTransactionDraft(content) {
  if (!content) return null;
  const fields = extractLabeledFields(content);
  if (!fields.amount) return null;
  const fieldCount = Object.keys(fields).length;
  if (fieldCount < MIN_FIELDS_FOR_STRUCTURED_MESSAGE) return null;

  const asksToConfirm = /¿?confirmas?\b|¿lo guardo\??|confirmas que guarde/i.test(content);
  if (!asksToConfirm) return null;

  return { fields, kind: 'draft' };
}

/**
 * Detects a duplicate-transaction warning: Finia found a similar recent
 * movement and is asking whether to save anyway.
 */
export function parseDuplicateWarning(content) {
  if (!content) return null;
  const mentionsDuplicate = /duplicad[oa]|movimiento similar|similar reciente/i.test(content);
  if (!mentionsDuplicate) return null;
  const asksToConfirm = /\?/.test(content);
  if (!asksToConfirm) return null;

  const fields = extractLabeledFields(content);
  return { fields, kind: 'duplicate' };
}

/**
 * Removes the labeled-field lines a card already renders, leaving any
 * remaining prose (intro line, trailing note, the confirmation question)
 * so it can still be shown under the card instead of being silently
 * dropped.
 */
export function stripLabeledFieldLines(content) {
  if (!content) return '';
  return content
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (trimmed.includes('|')) return false;
      if (/^[-—•*\s]*(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*)?[^:]+:\s*.+$/u.test(trimmed)) {
        // Only drop it if the label actually matched a known field —
        // otherwise we'd silently eat unrelated "Nota: ..." style lines.
        const m = trimmed.match(/^[-—•*\s]*(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*)?([^:]+):/u);
        const label = cleanLabel(m?.[1] || '');
        return !Object.values(FIELD_PATTERNS).some(p => p.test(label));
      }
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    // The draft/duplicate cards already carry their own icon for this signal
    // (✅/⚠️/❌/💡) — drop a redundant leading marker so it isn't shown twice.
    // ️ is the variation selector "⚠️" needs to render as emoji at all;
    // left unconsumed here it survives as an invisible leftover character.
    .replace(/^[✅⚠️❌💡]️?\s*/u, '');
}

// ─── Message classification (success / warning / error / suggestion) ──────

// Ordered by priority: an explicit emoji marker is the most reliable
// signal Finia gives us and wins outright. Keyword phrases are the
// fallback, matched as whole words/phrases (not raw substrings) so
// "no se guardó" doesn't get read the same as "guardado correctamente".
const EMOJI_TYPES = [
  ['success', '✅'],
  ['warning', '⚠️'],
  ['error', '❌'],
  ['suggestion', '💡'],
];

const KEYWORD_TYPES = [
  ['success', /\b(guardado(?:\s+correctamente)?|registrado correctamente|listo,?\s+movimiento registrado)\b/i],
  ['warning', /\b(posible duplicado|movimiento similar|cerca del l[ií]mite)\b/i],
  ['error', /\b(no pude verificar|algo sali[oó] mal|hubo un error|no se pudo)\b/i],
  ['suggestion', /\b(sugerencia|oportunidad de ahorro)\b/i],
];

export function classifyMessage(content) {
  if (!content) return 'normal';
  for (const [type, emoji] of EMOJI_TYPES) {
    if (content.includes(emoji)) return type;
  }
  for (const [type, pattern] of KEYWORD_TYPES) {
    if (pattern.test(content)) return type;
  }
  return 'normal';
}
