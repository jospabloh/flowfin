import { useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import { normalize as normalizeMerchant } from '@/lib/merchantNormalizer';

const LS_FAMILY_RULES = 'ff_family_rules';

function getUserPrefsKey(userId) {
  return `ff_user_prefs:${userId || 'anonymous'}`;
}

function readLS(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function writeLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// Normalize a description for use as a rule key.
// Tries canonical merchant name first, then falls back to raw text (lowercased, trimmed, max 40 chars).
function normalizeKey(description) {
  const merchant = normalizeMerchant(description);
  if (merchant) return merchant.toLowerCase();
  return description.toLowerCase().trim().slice(0, 40);
}

export function useMemory() {
  const { familyId, familyConfigId, currentUser } = useFamily();
  const saveTimerRef = useRef({});

  // ── USER PREFERENCES ─────────────────────────────────────────────────────────
  const getUserPref = useCallback((key, defaultVal = null) => {
    const prefsKey = getUserPrefsKey(currentUser?.id);
    const cached = readLS(prefsKey);
    return cached?.[key] ?? defaultVal;
  }, [currentUser?.id]);

  const setUserPref = useCallback((key, value) => {
    const prefsKey = getUserPrefsKey(currentUser?.id);
    const current = readLS(prefsKey) || {};
    const updated = { ...current, [key]: value };
    writeLS(prefsKey, updated);
    clearTimeout(saveTimerRef.current[`user_${key}`]);
    saveTimerRef.current[`user_${key}`] = setTimeout(() => {
      base44.auth.updateMe({ preferences: updated }).catch(() => {});
    }, 500);
  }, [currentUser?.id]);

  // ── FAMILY SMART RULES ────────────────────────────────────────────────────────
  const getFamilyRules = useCallback(() => {
    return readLS(LS_FAMILY_RULES) || {};
  }, []);

  const saveFamilyRules = useCallback((rules) => {
    writeLS(LS_FAMILY_RULES, rules);
    if (!familyConfigId) return;
    clearTimeout(saveTimerRef.current['family_rules']);
    saveTimerRef.current['family_rules'] = setTimeout(() => {
      base44.entities.FamilyConfig.update(familyConfigId, { smart_rules: rules }).catch(() => {});
    }, 1000);
  }, [familyConfigId]);

  const syncFamilyRulesFromDB = useCallback(async (familyConfigData) => {
    if (familyConfigData?.smart_rules) {
      writeLS(LS_FAMILY_RULES, familyConfigData.smart_rules);
    }
  }, []);

  const syncUserPrefsFromDB = useCallback(async () => {
    try {
      const me = await base44.auth.me();
      if (me?.preferences) {
        const prefsKey = getUserPrefsKey(me.id);
        writeLS(prefsKey, me.preferences);
      }
    } catch {}
  }, []);

  // ── ASSOCIATION LEARNING ──────────────────────────────────────────────────────
  /**
   * Records a completed capture: stores full triplet (desc → category+person+method) with weights.
   * If a previous suggestion was provided and the user changed it, penalizes the old association
   * and rewards the new one (negative signal learning, F2.7).
   *
   * @param {{ description, categoryId, subcategoryId, personId, paymentMethodId, type, previousSuggestion? }} params
   *   previousSuggestion: { categoryId, personId, paymentMethodId } — what was auto-suggested before user saved
   */
  const recordCapture = useCallback(({ description, categoryId, subcategoryId, personId, paymentMethodId, type, previousSuggestion }) => {
    if (!description || description.length < 2) return;

    const rules = getFamilyRules();
    const key = normalizeKey(description);
    if (!rules.associations) rules.associations = {};

    const existing = rules.associations[key] || { count: 0, confidence: 0 };

    const isSameAsPrevious = previousSuggestion &&
      previousSuggestion.categoryId === categoryId &&
      previousSuggestion.personId === personId &&
      previousSuggestion.paymentMethodId === paymentMethodId;

    const isCorrectionOfPrevious = previousSuggestion &&
      (previousSuggestion.categoryId !== categoryId ||
       previousSuggestion.personId !== personId ||
       previousSuggestion.paymentMethodId !== paymentMethodId);

    const isSameAsStored = existing.categoryId === categoryId &&
      existing.personId === personId &&
      existing.paymentMethodId === paymentMethodId;

    if (isSameAsStored) {
      // Reinforce existing: increase count and confidence (up to 10)
      rules.associations[key] = {
        ...existing,
        categoryId, subcategoryId, personId, paymentMethodId, type,
        count: (existing.count || 1) + 1,
        confidence: Math.min(10, (existing.confidence || 1) + 1),
        updatedAt: Date.now(),
      };
    } else if (isCorrectionOfPrevious) {
      // User corrected a suggestion — penalize stored association, learn new one
      // If confidence drops to 0, overwrite with the new association
      const newConfidence = (existing.confidence || 1) - 2;
      if (newConfidence <= 0 || existing.categoryId === previousSuggestion?.categoryId) {
        rules.associations[key] = {
          categoryId, subcategoryId, personId, paymentMethodId, type,
          count: 1,
          confidence: 1,
          updatedAt: Date.now(),
        };
      } else {
        // Keep existing but reduce confidence, also bump the new one
        rules.associations[key] = { ...existing, confidence: newConfidence, updatedAt: Date.now() };
      }
    } else {
      // New association (no conflict or prior suggestion): create fresh
      rules.associations[key] = {
        categoryId, subcategoryId, personId, paymentMethodId, type,
        count: 1,
        confidence: 1,
        updatedAt: Date.now(),
      };
    }

    // Keep only the 200 most recent associations
    const entries = Object.entries(rules.associations);
    if (entries.length > 200) {
      entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
      rules.associations = Object.fromEntries(entries.slice(0, 200));
    }

    saveFamilyRules(rules);
  }, [getFamilyRules, saveFamilyRules]);

  /**
   * Finds the best stored association for a description.
   * Returns { categoryId, subcategoryId, personId, paymentMethodId, confidence } or null.
   * Confidence < 2 = low (show suggestion only), >= 2 = high (can auto-fill).
   */
  const findAssociation = useCallback((description) => {
    if (!description || description.length < 2) return null;
    const rules = getFamilyRules();
    if (!rules.associations) return null;

    const query = normalizeKey(description);

    // Exact match first (highest priority)
    if (rules.associations[query]) {
      const a = rules.associations[query];
      if ((a.confidence || 1) > 0) return a;
    }

    // Partial match: find the association whose key is contained in the query or vice versa
    let best = null;
    let bestScore = 0;
    for (const [key, assoc] of Object.entries(rules.associations)) {
      if ((assoc.confidence || 1) <= 0) continue;
      let score = 0;
      if (query.includes(key)) score = key.length * (assoc.confidence || 1);
      else if (key.includes(query.slice(0, 20))) score = query.slice(0, 20).length * (assoc.confidence || 1) * 0.7;
      if (score > bestScore) { best = assoc; bestScore = score; }
    }
    return best;
  }, [getFamilyRules]);

  /**
   * Returns how many times a description has been seen (across any association).
   * Used to detect "auto-subcategory" candidates (F2.8).
   */
  const getDescriptionCount = useCallback((description) => {
    if (!description || description.length < 2) return 0;
    const rules = getFamilyRules();
    if (!rules.associations) return 0;
    const key = normalizeKey(description);
    return rules.associations[key]?.count || 0;
  }, [getFamilyRules]);

  return {
    getUserPref,
    setUserPref,
    getFamilyRules,
    saveFamilyRules,
    syncFamilyRulesFromDB,
    syncUserPrefsFromDB,
    recordCapture,
    findAssociation,
    getDescriptionCount,
  };
}
