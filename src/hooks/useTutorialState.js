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

  const lastPersistedSerializedRef = useRef(JSON.stringify(INITIAL_TUTORIAL_STATE));
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

        const serialized = JSON.stringify(nextState);
        if (serialized === lastPersistedSerializedRef.current) {
          continue;
        }

        try {
          await saveToFamilyMembership(nextState);
          lastPersistedSerializedRef.current = serialized;
          writeFallbackTutorialState(currentUser?.id, nextState);
        } catch {
          pendingStateRef.current = pendingStateRef.current || nextState;
          break;
        }
      }
    } finally {
      isPersistingRef.current = false;
      if (pendingStateRef.current && !workerPromiseRef.current) {
        workerPromiseRef.current = drainPersistQueue().finally(() => {
          workerPromiseRef.current = null;
        });
      }
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
    const hydrated = sanitizeTutorialState(
      membership?.tutorial_state || readFallbackTutorialState(currentUser?.id)
    );

    setTutorialState(hydrated);
    lastPersistedSerializedRef.current = JSON.stringify(hydrated);
    pendingStateRef.current = null;
  }, [membership?.id, membership?.tutorial_state, currentUser?.id]);

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
