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
    // Ignore localStorage read/parse failures and fall back to null state.
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

// Simple, reliable dismiss flag keyed on membership.id (always available when the
// tutorial is active). Independent of the backend persist — written synchronously
// so it survives page refreshes even when the API call fails.
//
// Stores the actual terminal status (COMPLETED/SKIPPED), not just a boolean. That's
// what lets the hook self-heal: if the FamilyMembership.update() that should have
// persisted this to the backend failed silently (see drainPersistQueue below — a
// dropped write is never retried on its own), the next time this device hydrates it
// can tell the backend still disagrees and re-issue the write. A plain boolean flag
// can only stop the tutorial from reopening on *this* browser; it can't fix the
// backend record, so any other browser/device for the same admin would keep seeing
// the tutorial forever even though the user already dismissed it here.
const TUTORIAL_DONE_PREFIX = 'ff:td:';

function readLocalTerminalStatus(membershipId) {
  if (!membershipId) return null;
  try {
    const raw = localStorage.getItem(TUTORIAL_DONE_PREFIX + membershipId);
    if (!raw) return null;
    // Back-compat: builds before this fix stored the literal string '1'. Treat any
    // pre-existing flag as SKIPPED (the safer "don't reopen" interpretation) rather
    // than dropping it and letting the tutorial reappear for people who already
    // dismissed it under the old scheme.
    if (raw === '1') return FLOWFIN_TUTORIAL_STATUS.SKIPPED;
    return raw;
  } catch {
    return null;
  }
}

function isTutorialDone(membershipId) {
  return !!readLocalTerminalStatus(membershipId);
}

// SKIPPED and COMPLETED are terminal: once the user has said "never again",
// nothing may walk that back. IN_PROGRESS/POSTPONED are not.
const TERMINAL_STATUSES = new Set([
  FLOWFIN_TUTORIAL_STATUS.SKIPPED,
  FLOWFIN_TUTORIAL_STATUS.COMPLETED,
]);

function isTerminal(status) {
  return TERMINAL_STATUSES.has(status);
}

export function markTutorialDone(membershipId, status) {
  if (!membershipId) return;
  try {
    localStorage.setItem(
      TUTORIAL_DONE_PREFIX + membershipId,
      status || FLOWFIN_TUTORIAL_STATUS.SKIPPED
    );
  } catch {
    // Ignore localStorage write failures; tutorial can still proceed.
  }
}

// The ONLY way out of the terminal state: an explicit restart from Mi Familia.
export function clearTutorialDone(membershipId) {
  if (!membershipId) return;
  try {
    localStorage.removeItem(TUTORIAL_DONE_PREFIX + membershipId);
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
  const drainPersistQueueRef = useRef(null);
  const terminalRetriedRef = useRef(false);
  // Mirror of tutorialState, so the terminal guard in applyTutorialUpdate can
  // evaluate a candidate update without going through setState.
  const tutorialStateRef = useRef(INITIAL_TUTORIAL_STATE);

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
          // Un estado NO terminal (in_progress / postponed) se puede perder sin
          // consecuencias: el próximo cambio de paso vuelve a intentarlo, y
          // re-encolar aquí solo alimentaría el loop de PUTs que este archivo ya
          // documenta. Un estado TERMINAL es otra cosa: si se pierde, el usuario
          // que pulsó "Omitir" vuelve a ver el tutorial. Se re-encola una sola
          // vez — el `while` lo reintentará — y si vuelve a fallar queda para el
          // self-heal del próximo arranque, que sí lo reintenta con el flag local.
          if (isTerminal(nextState?.status) && !terminalRetriedRef.current) {
            terminalRetriedRef.current = true;
            pendingStateRef.current = nextState;
            continue;
          }
          break;
        }
      }
    } finally {
      isPersistingRef.current = false;
    }

    // Algo entró mientras vaciábamos la cola (o mientras el worker se apagaba):
    // hay que vaciarla otra vez. Sin esto, un enqueue que caía en esa ventana se
    // perdía en silencio — `enqueuePersist` no arrancaba un worker nuevo porque
    // `workerPromiseRef` todavía no era null, y el worker vivo ya había salido
    // del `while`. Ese era exactamente el camino por el que se perdía el
    // "Omitir": el write de SKIPPED llegaba mientras el persist del paso actual
    // se estaba apagando, y nunca se escribía.
    if (pendingStateRef.current) {
      await drainPersistQueueRef.current?.();
    }
  }, [currentUser?.id, saveToFamilyMembership]);

  // Mantiene una referencia estable a la última versión de drainPersistQueue,
  // para poder re-entrar sin crear una dependencia circular en el useCallback.
  drainPersistQueueRef.current = drainPersistQueue;

  const enqueuePersist = useCallback((stateToPersist) => {
    pendingStateRef.current = stateToPersist;

    // Se arranca un worker cuando NO hay uno vaciando la cola. Antes esto miraba
    // `workerPromiseRef`, que sigue siendo no-nulo durante el microtask entre que
    // el worker sale de su `while` y su `.finally()` lo limpia — así que un
    // enqueue en esa ventana no arrancaba worker y su estado moría en la cola.
    // `isPersistingRef` sí refleja "hay alguien vaciando ahora mismo", y el
    // re-drain al final de drainPersistQueue cubre el resto de la ventana.
    if (!isPersistingRef.current) {
      workerPromiseRef.current = drainPersistQueue().finally(() => {
        workerPromiseRef.current = null;
      });
    }

    return workerPromiseRef.current || Promise.resolve();
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

  const applyTutorialUpdate = useCallback((updater, { allowAfterTerminal = false } = {}) => {
    // Terminal is a ONE-WAY DOOR. Once this device knows the user chose
    // "Omitir" (or finished), no later update may write a non-terminal status
    // over it. Without this, any still-in-flight or late-firing
    // setCurrentStep/startOrResume — and there are several, since the step
    // effects run on render — could put the record back to `in_progress`, and
    // the tutorial would reopen on the next load exactly as if the user had
    // never dismissed it. Only restartFromBeginning (which clears the flag
    // first) is allowed through.
    if (
      !allowAfterTerminal
      && isTutorialDone(membership?.id)
    ) {
      const candidate = sanitizeTutorialState(
        typeof updater === 'function' ? updater(sanitizeTutorialState(tutorialStateRef.current)) : updater
      );
      if (!isTerminal(candidate.status)) return;
    }

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

  // Self-heal: this device already knows the tutorial was dismissed (the local
  // terminal-status flag is set), but the backend record hasn't caught up — most
  // likely a previous skip/complete's persist attempt failed and was never retried
  // (drainPersistQueue intentionally doesn't requeue on failure, see its comment).
  // Re-issue that write now so the backend — and every other device/browser for
  // this admin — converges on the same "done" state instead of relying forever on
  // this one browser's localStorage.
  useEffect(() => {
    if (!isHydrated || !membership?.id) return;

    const localTerminalStatus = readLocalTerminalStatus(membership.id);
    if (!localTerminalStatus) return;
    if (membership?.tutorial_state?.status === localTerminalStatus) return;

    void applyTutorialUpdate((prev) => ({
      ...prev,
      status: localTerminalStatus,
      updated_at: new Date().toISOString(),
    }));
  }, [isHydrated, membership?.id, membership?.tutorial_state?.status, applyTutorialUpdate]);

  useEffect(() => {
    tutorialStateRef.current = tutorialState;
  }, [tutorialState]);

  const shouldAutoOpen = useMemo(() => {
    if (membership === undefined) return false; // Still loading
    // Primary check: synchronous localStorage flag keyed on membership.id.
    // This is written immediately on skip/complete and survives refresh regardless
    // of whether the backend API call succeeds.
    if (isTutorialDone(membership?.id)) return false;
    // Secondary check: backend state or localStorage fallback (best-effort).
    const rawState = membership?.tutorial_state
      || readFallbackTutorialState(currentUser?.id);
    const rawStatus = rawState?.status || FLOWFIN_TUTORIAL_STATUS.NOT_STARTED;
    return ![
      FLOWFIN_TUTORIAL_STATUS.COMPLETED,
      FLOWFIN_TUTORIAL_STATUS.SKIPPED,
    ].includes(rawStatus);
  }, [membership, currentUser?.id]);

  const startOrResume = useCallback(() => {
    return applyTutorialUpdate((prev) => ({
      ...prev,
      status: FLOWFIN_TUTORIAL_STATUS.IN_PROGRESS,
      current_step: prev.current_step || FLOWFIN_TUTORIAL_FIRST_STEP,
      updated_at: new Date().toISOString(),
    }));
  }, [applyTutorialUpdate]);

  const restartFromBeginning = useCallback(() => {
    // The explicit "volver a ver el tutorial" action from Mi Familia — the one
    // sanctioned way back out of the terminal state.
    clearTutorialDone(membership?.id);
    terminalRetriedRef.current = false;
    return applyTutorialUpdate((prev) => ({
      ...prev,
      status: FLOWFIN_TUTORIAL_STATUS.IN_PROGRESS,
      current_step: FLOWFIN_TUTORIAL_FIRST_STEP,
      updated_at: new Date().toISOString(),
    }), { allowAfterTerminal: true });
  }, [applyTutorialUpdate, membership?.id]);

  const setCurrentStep = useCallback((stepId) => {
    if (!stepId) return;
    return applyTutorialUpdate((prev) => ({
      ...prev,
      status: FLOWFIN_TUTORIAL_STATUS.IN_PROGRESS,
      current_step: stepId,
      updated_at: new Date().toISOString(),
    }));
  }, [applyTutorialUpdate]);

  const markPostponed = useCallback((stepId) => {
    return applyTutorialUpdate((prev) => ({
      ...prev,
      status: FLOWFIN_TUTORIAL_STATUS.POSTPONED,
      current_step: stepId || prev.current_step,
      updated_at: new Date().toISOString(),
    }));
  }, [applyTutorialUpdate]);

  const markSkipped = useCallback((stepId) => {
    // Written here as well as in the controller, so the "never again"
    // guarantee doesn't depend on every call site remembering to do it.
    markTutorialDone(membership?.id, FLOWFIN_TUTORIAL_STATUS.SKIPPED);
    return applyTutorialUpdate((prev) => ({
      ...prev,
      status: FLOWFIN_TUTORIAL_STATUS.SKIPPED,
      current_step: stepId || prev.current_step,
      updated_at: new Date().toISOString(),
    }), { allowAfterTerminal: true });
  }, [applyTutorialUpdate, membership?.id]);

  const markCompleted = useCallback(() => {
    markTutorialDone(membership?.id, FLOWFIN_TUTORIAL_STATUS.COMPLETED);
    return applyTutorialUpdate((prev) => ({
      ...prev,
      status: FLOWFIN_TUTORIAL_STATUS.COMPLETED,
      updated_at: new Date().toISOString(),
    }), { allowAfterTerminal: true });
  }, [applyTutorialUpdate, membership?.id]);

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
