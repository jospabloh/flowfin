/**
 * useMemory — Hook de "memoria" sin créditos IA
 *
 * Guarda y recupera:
 *  - Preferencias de usuario (level: 'user')  → User.preferences via base44.auth.updateMe
 *  - Reglas/asociaciones familiares (level: 'family') → FamilyConfig.smart_rules
 *
 * Uso:
 *   const { getUserPref, setUserPref, getFamilyRule, recordCapture } = useMemory();
 */

import { useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';

// ── Helpers de localStorage ───────────────────────────────────────────────────────
const LS_FAMILY_RULES = 'ff_family_rules';

// User prefs are scoped per user to prevent cross-user cache leaks
function getUserPrefsKey(userId) {
  return `ff_user_prefs:${userId || 'anonymous'}`;
}

function readLS(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function writeLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── Hook principal ────────────────────────────────────────────────────────────────
export function useMemory() {
  const { familyId, familyConfigId, currentUser } = useFamily();
  const saveTimerRef = useRef({});

  // ── USER PREFERENCES (scoped per user) ───────────────────────────────────────
  /** Lee una preferencia de usuario (primero caché local, luego DB) */
  const getUserPref = useCallback((key, defaultVal = null) => {
    const prefsKey = getUserPrefsKey(currentUser?.id);
    const cached = readLS(prefsKey);
    return cached?.[key] ?? defaultVal;
  }, [currentUser?.id]);

  /** Guarda una preferencia de usuario con debounce (500ms) para evitar escrituras excesivas */
  const setUserPref = useCallback((key, value) => {
    const prefsKey = getUserPrefsKey(currentUser?.id);
    const current = readLS(prefsKey) || {};
    const updated = { ...current, [key]: value };
    writeLS(prefsKey, updated);

    // Debounce: espera 500ms antes de persistir en DB
    clearTimeout(saveTimerRef.current[`user_${key}`]);
    saveTimerRef.current[`user_${key}`] = setTimeout(() => {
      base44.auth.updateMe({ preferences: updated }).catch(() => {});
    }, 500);
  }, [currentUser?.id]);

  // ── FAMILY SMART RULES ────────────────────────────────────────────────────────
  /** Lee las reglas familiares del caché local */
  const getFamilyRules = useCallback(() => {
    return readLS(LS_FAMILY_RULES) || {};
  }, []);

  /** Persiste las reglas familiares en DB con debounce (1s) */
  const saveFamilyRules = useCallback((rules) => {
    writeLS(LS_FAMILY_RULES, rules);
    if (!familyConfigId) return;
    clearTimeout(saveTimerRef.current['family_rules']);
    saveTimerRef.current['family_rules'] = setTimeout(() => {
      base44.entities.FamilyConfig.update(familyConfigId, { smart_rules: rules }).catch(() => {});
    }, 1000);
  }, [familyConfigId]);

  /**
   * Carga las reglas familiares desde DB al localStorage.
   * Llamar al inicio de sesión o cuando cambie la familia.
   */
  const syncFamilyRulesFromDB = useCallback(async (familyConfigData) => {
    if (familyConfigData?.smart_rules) {
      writeLS(LS_FAMILY_RULES, familyConfigData.smart_rules);
    }
  }, []);

  /**
   * Carga las preferencias de usuario desde DB al localStorage.
   * Llamar al inicio de sesión.
   */
  const syncUserPrefsFromDB = useCallback(async () => {
    try {
      const me = await base44.auth.me();
      if (me?.preferences) {
        const prefsKey = getUserPrefsKey(me.id);
        writeLS(prefsKey, me.preferences);
      }
    } catch {}
  }, []);

  // ── REGLAS DE ASOCIACIÓN ──────────────────────────────────────────────────────
  /**
   * Registra una captura: aprende la asociación descripción → categoría/persona/método.
   * Se llama después de guardar un movimiento exitosamente.
   */
  const recordCapture = useCallback(({ description, categoryId, subcategoryId, personId, paymentMethodId, type }) => {
    if (!description || description.length < 2) return;

    const rules = getFamilyRules();
    const key = description.toLowerCase().trim().slice(0, 40);

    // Estructura: rules.associations[key] = { categoryId, subcategoryId, personId, paymentMethodId, type, count }
    if (!rules.associations) rules.associations = {};
    const existing = rules.associations[key];

    if (existing && existing.categoryId === categoryId && existing.personId === personId) {
      // Reforzar asociación existente
      rules.associations[key] = { ...existing, count: (existing.count || 1) + 1, updatedAt: Date.now() };
    } else {
      // Nueva asociación o diferente
      rules.associations[key] = { categoryId, subcategoryId, personId, paymentMethodId, type, count: 1, updatedAt: Date.now() };
    }

    // Mantener solo las 200 asociaciones más recientes
    const entries = Object.entries(rules.associations);
    if (entries.length > 200) {
      entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
      rules.associations = Object.fromEntries(entries.slice(0, 200));
    }

    saveFamilyRules(rules);
  }, [getFamilyRules, saveFamilyRules]);

  /**
   * Busca una asociación para una descripción dada.
   * Retorna { categoryId, subcategoryId, personId, paymentMethodId } o null.
   */
  const findAssociation = useCallback((description) => {
    if (!description || description.length < 2) return null;
    const rules = getFamilyRules();
    if (!rules.associations) return null;

    const query = description.toLowerCase().trim();

    // Búsqueda exacta primero
    if (rules.associations[query.slice(0, 40)]) {
      return rules.associations[query.slice(0, 40)];
    }

    // Búsqueda parcial: busca si alguna clave guardada está contenida en la descripción actual
    let best = null;
    let bestCount = 0;
    for (const [key, assoc] of Object.entries(rules.associations)) {
      if (query.includes(key) || key.includes(query.slice(0, 20))) {
        if ((assoc.count || 1) > bestCount) {
          best = assoc;
          bestCount = assoc.count || 1;
        }
      }
    }
    return best;
  }, [getFamilyRules]);

  return {
    // User prefs
    getUserPref,
    setUserPref,
    // Family rules
    getFamilyRules,
    saveFamilyRules,
    syncFamilyRulesFromDB,
    syncUserPrefsFromDB,
    // Association learning
    recordCapture,
    findAssociation,
  };
}