import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useFamily } from '@/lib/FamilyContext';
import {
  FLOWFIN_TUTORIAL_FALLBACK_PREFIX,
  FLOWFIN_TUTORIAL_FIRST_STEP,
  FLOWFIN_TUTORIAL_STATUS,
  FLOWFIN_TUTORIAL_STORAGE_KEY,
  FLOWFIN_TUTORIAL_VERSION,
} from '@/lib/tutorial/tutorialConstants';

const DEFAULT_STATE = {
  status: FLOWFIN_TUTORIAL_STATUS.NOT_STARTED,
  current_step: FLOWFIN_TUTORIAL_FIRST_STEP,
  last_seen_at: null,
  dismissed_at: null,
  completed_at: null,
  version: FLOWFIN_TUTORIAL_VERSION,
};

function makeFallbackKey(familyId, userId) {
  return `${FLOWFIN_TUTORIAL_FALLBACK_PREFIX}:${familyId || 'no-family'}:${userId || 'no-user'}`;
}

function readLocalState(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalState(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op
  }
}

function getBestTimestamp(state) {
  if (!state) return 0;
  return Math.max(
    Date.parse(state.last_seen_at || 0) || 0,
    Date.parse(state.dismissed_at || 0) || 0,
    Date.parse(state.completed_at || 0) || 0
  );
}

function resolvePreferredState(serverState, localState) {
  if (!serverState && !localState) return DEFAULT_STATE;
  if (serverState && !localState) return { ...DEFAULT_STATE, ...serverState };
  if (!serverState && localState) return { ...DEFAULT_STATE, ...localState };

  const serverTs = getBestTimestamp(serverState);
  const localTs = getBestTimestamp(localState);

  return { ...DEFAULT_STATE, ...(localTs >= serverTs ? localState : serverState) };
}

export function useTutorialState() {
  const { membership, familyId, currentUser, isAdmin, refetchMembership } = useFamily();

  const fallbackKey = useMemo(
    () => makeFallbackKey(familyId, currentUser?.id),
    [familyId, currentUser?.id]
  );

  const serverState = membership?.tutorial_state?.[FLOWFIN_TUTORIAL_STORAGE_KEY] || null;

  const [localState, setLocalState] = useState(() => readLocalState(fallbackKey));
  const [tutorialState, setTutorialState] = useState(DEFAULT_STATE);

  useEffect(() => {
    setLocalState(readLocalState(fallbackKey));
  }, [fallbackKey]);

  const mergedState = useMemo(
    () => resolvePreferredState(serverState, localState),
    [serverState, localState]
  );

  useEffect(() => {
    setTutorialState(mergedState);
  }, [mergedState]);

  const persistState = useCallback(
    async (patch) => {
      const nextState = {
        ...DEFAULT_STATE,
        ...tutorialState,
        ...patch,
        version: FLOWFIN_TUTORIAL_VERSION,
        last_seen_at: new Date().toISOString(),
      };

      setTutorialState(nextState);
      setLocalState(nextState);
      writeLocalState(fallbackKey, nextState);

      if (!membership?.id) return nextState;

      try {
        await base44.entities.FamilyMembership.update(membership.id, {
          tutorial_state: {
            ...(membership?.tutorial_state || {}),
            [FLOWFIN_TUTORIAL_STORAGE_KEY]: nextState,
          },
        });

        await refetchMembership();
      } catch (error) {
        console.error('No se pudo persistir tutorial_state en FamilyMembership:', error);
      }

      return nextState;
    },
    [fallbackKey, membership?.id, membership?.tutorial_state, refetchMembership, tutorialState]
  );

  const shouldAutoOpen =
    !!isAdmin &&
    !!familyId &&
    !!membership?.id &&
    [
      FLOWFIN_TUTORIAL_STATUS.NOT_STARTED,
      FLOWFIN_TUTORIAL_STATUS.IN_PROGRESS,
      FLOWFIN_TUTORIAL_STATUS.POSTPONED,
    ].includes(tutorialState.status);

  const startOrResume = useCallback(async () => {
    return persistState({
      status:
        tutorialState.status === FLOWFIN_TUTORIAL_STATUS.NOT_STARTED
          ? FLOWFIN_TUTORIAL_STATUS.IN_PROGRESS
          : tutorialState.status,
      current_step: tutorialState.current_step || FLOWFIN_TUTORIAL_FIRST_STEP,
    });
  }, [persistState, tutorialState.current_step, tutorialState.status]);

  const restartFromBeginning = useCallback(async () => {
    return persistState({
      status: FLOWFIN_TUTORIAL_STATUS.IN_PROGRESS,
      current_step: FLOWFIN_TUTORIAL_FIRST_STEP,
      dismissed_at: null,
      completed_at: null,
    });
  }, [persistState]);

  const setCurrentStep = useCallback(
    async (stepId) => {
      return persistState({
        status: FLOWFIN_TUTORIAL_STATUS.IN_PROGRESS,
        current_step: stepId,
      });
    },
    [persistState]
  );

  const markPostponed = useCallback(
    async (stepId) => {
      return persistState({
        status: FLOWFIN_TUTORIAL_STATUS.POSTPONED,
        current_step: stepId || tutorialState.current_step || FLOWFIN_TUTORIAL_FIRST_STEP,
      });
    },
    [persistState, tutorialState.current_step]
  );

  const markSkipped = useCallback(
    async (stepId) => {
      return persistState({
        status: FLOWFIN_TUTORIAL_STATUS.SKIPPED,
        current_step: stepId || tutorialState.current_step || FLOWFIN_TUTORIAL_FIRST_STEP,
        dismissed_at: new Date().toISOString(),
      });
    },
    [persistState, tutorialState.current_step]
  );

  const markCompleted = useCallback(async () => {
    return persistState({
      status: FLOWFIN_TUTORIAL_STATUS.COMPLETED,
      current_step: FLOWFIN_TUTORIAL_FIRST_STEP,
      completed_at: new Date().toISOString(),
    });
  }, [persistState]);

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