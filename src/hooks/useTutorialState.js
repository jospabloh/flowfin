import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import {
  FLOWFIN_TUTORIAL_FIRST_STEP,
  FLOWFIN_TUTORIAL_STATUS,
  FLOWFIN_TUTORIAL_STORAGE_KEY,
  FLOWFIN_TUTORIAL_VERSION,
} from '@/lib/tutorial/tutorialConstants';

const INITIAL_TUTORIAL_STATE = {
  version: FLOWFIN_TUTORIAL_VERSION,
  status: FLOWFIN_TUTORIAL_STATUS.NOT_STARTED,
  current_step: FLOWFIN_TUTORIAL_FIRST_STEP,
  updated_at: null,
};

const MAX_429_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 400;

function is429Error(error) {
  return error?.status === 429 || error?.response?.status === 429 || error?.code === 429;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sanitizeTutorialState(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    return { ...INITIAL_TUTORIAL_STATE };
  }

  const allowedStatuses = new Set(Object.values(FLOWFIN_TUTORIAL_STATUS));
  const status = allowedStatuses.has(rawState.status)
    ? rawState.status
    : FLOWFIN_TUTORIAL_STATUS.NOT_STARTED;

  return {
    version: rawState.version || FLOWFIN_TUTORIAL_VERSION,
    status,
    current_step: rawState.current_step || FLOWFIN_TUTORIAL_FIRST_STEP,
    updated_at: rawState.updated_at || null,
  };
}

// Serializa solo los campos significativos del tutorial, excluyendo `updated_at`.
// Esto es clave para la deduplicación: cada llamada a `applyTutorialUpdate` genera
// un `updated_at` nuevo, por lo que una comparación que lo incluyera nunca encontraría
// duplicados y dispararía un PUT en cada render → 429 → loop infinito.
function serializeForDedup(state) {
  if (!state || typeof state !== 'object') return '';
  return JSON.stringify({
    version: state.version || null,
    status: state.status || null,
    current_step: state.current_step || null,
  });
}

function readFallbackTutorialState(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${FLOWFIN_TUTORIAL_STORAGE_KEY}:${userId}`);
    return raw ? sanitizeTutorialState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeFallbackTutorialState(userId, state) {
  if (!userId) return;
  try {
    localStorage.setItem(`${FLOWFIN_TUTORIAL_STORAGE_KEY}:${userId}`, JSON.stringify(state));
  } catch {
    // ignore localStorage failures
  }
}

export function useTutorialState() {
  const { membership, currentUser } = useFamily();
  const [tutorialState, setTutorialState] = useState(INITIAL_TUTORIAL_STATE);
  const [isHydrated, setIsHydrated] = useState(false);

  const lastPersistedSerializedRef = useRef(serializeForDedup(INITIAL_TUTORIAL_STATE));
  const pendingStateRef = useRef(null);
  const isPersistingRef = useRef(false);
  const workerPromiseRef = useRef(null);

  const saveToFamilyMembership = useCallback(async (stateToSave) => {
    if (!membership?.id) return;

    for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt += 1) {
      try {
        await base44.entities.FamilyMembership.update(membership.id, {
          tutorial_state: stateToSave,
        });
        return;
      } catch (error) {
        if (!is429Error(error) || attempt >= MAX_429_RETRIES) {
          throw error;
        }

        const jitterMs = Math.floor(Math.random() * 75);
        const waitMs = Math.min(BASE_RETRY_DELAY_MS * (2 ** attempt), 4000) + jitterMs;
        await delay(waitMs);
      }
    }
  }, [membership?.id]);

  const drainPersistQueue = useCallback(async () => {
    if (isPersistingRef.current) return;

    isPersistingRef.current = true;
    try {
      while (pendingStateRef.current) {
        const nextState = pendingStateRef.current;
        pendingStateRef.current = null;

        const dedupKey = serializeForDedup(nextState);
        if (dedupKey === lastPersistedSerializedRef.current) {
          // Mismo (version, status, current_step) que el último guardado exitoso:
          // no tiene sentido volver a pegarle a la API solo porque el timestamp cambió.
          // Aún así, mantenemos la copia local actualizada para que el fallback vea
          // el último `updated_at` emitido.
          writeFallbackTutorialState(currentUser?.id, nextState);
          continue;
        }

        try {
          await saveToFamilyMembership(nextState);
          lastPersistedSerializedRef.current = dedupKey;
          writeFallbackTutorialState(currentUser?.id, nextState);
        } catch {
          // Si falla (p.ej. 429 tras todos los retries), NO re-encolamos ni recursamos.
          // El estado real vive en React + localStorage; el próximo cambio de paso
          // volverá a intentar persistir. Re-encolar aquí solo alimentaría el loop.
          break;
        }
      }
    } finally {
      isPersistingRef.current = false;
      // Nota: no reenganchamos drainPersistQueue desde aquí. Si una nueva llamada
      // a `enqueuePersist` entra mientras corríamos, ella se encarga de arrancar
      // un nuevo worker cuando `workerPromiseRef` quede en null. Evita recursión
      // implícita que pudo contribuir al ciclo de PUTs.
    }
  }, [currentUser?.id, saveToFamilyMembership]);

  const enqueuePersist = useCallback((stateToPersist) => {
    pendingStateRef.current = stateToPersist;

    if (!workerPromiseRef.current) {
      workerPromiseRef.current = drainPersistQueue().finally(() => {
        workerPromiseRef.current = null;
      });
    }

    return workerPromiseRef.current;
  }, [drainPersistQueue]);

  useEffect(() => {
    // Wait until the membership query has resolved (undefined = still loading).
    // membership === null means the user has no membership, which is also a valid
    // resolved state (isAdmin will be false and the tutorial won't show).
    if (membership === undefined) return;

    const hydrated = sanitizeTutorialState(
      membership?.tutorial_state || readFallbackTutorialState(currentUser?.id)
    );

    setTutorialState(hydrated);
    lastPersistedSerializedRef.current = serializeForDedup(hydrated);
    pendingStateRef.current = null;
    // Batched with setTutorialState — the render that sets isHydrated=true already
    // has the correct tutorialState, so shouldAutoOpen is accurate in that render.
    setIsHydrated(true);
  }, [membership, currentUser?.id]);

  const applyTutorialUpdate = useCallback(async (updater) => {
    let nextState;
    setTutorialState((prevState) => {
      const currentState = sanitizeTutorialState(prevState);
      nextState = sanitizeTutorialState(
        typeof updater === 'function' ? updater(currentState) : updater
      );
      return nextState;
    });

    if (!nextState) return;

    if (!membership?.id) {
      writeFallbackTutorialState(currentUser?.id, nextState);
      return;
    }

    return enqueuePersist(nextState);
  }, [currentUser?.id, enqueuePersist, membership?.id]);

  const shouldAutoOpen = useMemo(() => {
    return ![
      FLOWFIN_TUTORIAL_STATUS.COMPLETED,
      FLOWFIN_TUTORIAL_STATUS.SKIPPED,
    ].includes(tutorialState.status);
  }, [tutorialState.status]);

  const startOrResume = useCallback(async () => {
    return applyTutorialUpdate((prev) => ({
      ...prev,
      status: FLOWFIN_TUTORIAL_STATUS.IN_PROGRESS,
      current_step: prev.current_step || FLOWFIN_TUTORIAL_FIRST_STEP,
      updated_at: new Date().toISOString(),
    }));
  }, [applyTutorialUpdate]);

  const restartFromBeginning = useCallback(async () => {
    return applyTutorialUpdate((prev) => ({
      ...prev,
      status: FLOWFIN_TUTORIAL_STATUS.IN_PROGRESS,
      current_step: FLOWFIN_TUTORIAL_FIRST_STEP,
      updated_at: new Date().toISOString(),
    }));
  }, [applyTutorialUpdate]);

  const setCurrentStep = useCallback(async (stepId) => {
    if (!stepId) return;
    return applyTutorialUpdate((prev) => ({
      ...prev,
      status: FLOWFIN_TUTORIAL_STATUS.IN_PROGRESS,
      current_step: stepId,
      updated_at: new Date().toISOString(),
    }));
  }, [applyTutorialUpdate]);

  const markPostponed = useCallback(async (stepId) => {
    return applyTutorialUpdate((prev) => ({
      ...prev,
      status: FLOWFIN_TUTORIAL_STATUS.POSTPONED,
      current_step: stepId || prev.current_step,
      updated_at: new Date().toISOString(),
    }));
  }, [applyTutorialUpdate]);

  const markSkipped = useCallback(async (stepId) => {
    return applyTutorialUpdate((prev) => ({
      ...prev,
      status: FLOWFIN_TUTORIAL_STATUS.SKIPPED,
      current_step: stepId || prev.current_step,
      updated_at: new Date().toISOString(),
    }));
  }, [applyTutorialUpdate]);

  const markCompleted = useCallback(async () => {
    return applyTutorialUpdate((prev) => ({
      ...prev,
      status: FLOWFIN_TUTORIAL_STATUS.COMPLETED,
      updated_at: new Date().toISOString(),
    }));
  }, [applyTutorialUpdate]);

  return {
    tutorialState,
    isHydrated,
    shouldAutoOpen,
    startOrResume,
    restartFromBeginning,
    setCurrentStep,
    markPostponed,
    markSkipped,
    markCompleted,
  };
}

export default useTutorialState;
