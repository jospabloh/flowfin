import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFamily } from '@/lib/FamilyContext';
import { useTutorialState, markTutorialDone } from '@/hooks/useTutorialState';
import {
  FLOWFIN_TUTORIAL_STEPS,
  getTutorialStepIndex,
} from '@/lib/tutorial/flowfinTutorialSteps';
import { FLOWFIN_TUTORIAL_START_EVENT } from '@/lib/tutorial/tutorialEvents';
import TutorialOverlay from './TutorialOverlay';
import { useToast } from '@/components/ui/use-toast';

const TARGET_RETRY_MS = 180;
const TARGET_MAX_RETRIES = 40;

function getScrollableContainer() {
  return document.getElementById('main-scroll') || document.scrollingElement || document.documentElement;
}

function scrollElementIntoContainerView(element) {
  if (!element) return;

  const container = getScrollableContainer();
  const elementRect = element.getBoundingClientRect();

  if (container && container.id === 'main-scroll') {
    const containerRect = container.getBoundingClientRect();
    const currentScrollTop = container.scrollTop;

    const targetTop =
      currentScrollTop +
      (elementRect.top - containerRect.top) -
      Math.max(24, Math.min(120, globalThis.innerHeight * 0.16));

    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth',
    });
    return;
  }

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest',
  });
}

function getRectWithViewportSupport(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();

  const viewportOffsetTop = globalThis.visualViewport?.offsetTop || 0;
  const viewportOffsetLeft = globalThis.visualViewport?.offsetLeft || 0;

  return {
    top: rect.top + viewportOffsetTop,
    left: rect.left + viewportOffsetLeft,
    width: rect.width,
    height: rect.height,
    right: rect.right + viewportOffsetLeft,
    bottom: rect.bottom + viewportOffsetTop,
  };
}

export default function TutorialController() {
  const { isAdmin, family, isLoading, membership } = useFamily();
  const {
    tutorialState,
    isHydrated,
    shouldAutoOpen,
    startOrResume,
    restartFromBeginning,
    setCurrentStep,
    markPostponed,
    markSkipped,
    markCompleted,
  } = useTutorialState();

  const { toast } = useToast();

  const location = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [activeStepId, setActiveStepId] = useState(tutorialState.current_step);
  const [targetRect, setTargetRect] = useState(null);
  const [resolvedTargetElement, setResolvedTargetElement] = useState(null);

  const retryTimerRef = useRef(null);
  const rectTimeoutRef = useRef(null);
  const autoOpenAttemptedRef = useRef(false);
  const sessionDismissedRef = useRef(false);

  const stepIndex = useMemo(
    () => getTutorialStepIndex(activeStepId || tutorialState.current_step),
    [activeStepId, tutorialState.current_step]
  );

  const step = FLOWFIN_TUTORIAL_STEPS[stepIndex];

  useEffect(() => {
    setActiveStepId(tutorialState.current_step);
  }, [tutorialState.current_step]);

  useEffect(() => {
    autoOpenAttemptedRef.current = false;
    sessionDismissedRef.current = false;
    setIsOpen(false);
    setTargetRect(null);
    setResolvedTargetElement(null);
  }, [family?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    if (isLoading) return;          // Wait until family+membership fully loaded (DOM ready)
    if (!shouldAutoOpen) return;    // Computed from membership directly — no render lag
    if (!isHydrated) return;        // Ensures activeStepId is hydrated from correct step
    if (autoOpenAttemptedRef.current) return;
    if (sessionDismissedRef.current) return;

    autoOpenAttemptedRef.current = true;
    setIsOpen(true);
    void startOrResume();
  }, [isAdmin, isLoading, shouldAutoOpen, isHydrated, startOrResume]);

  useEffect(() => {
    const handleManualStart = () => {
      if (!isAdmin) return;

      sessionDismissedRef.current = false;
      autoOpenAttemptedRef.current = true;

      // Fire-and-forget: React state updates inside restartFromBeginning are
      // synchronous (batched); only the API persist is async and runs in background.
      void restartFromBeginning();
      setActiveStepId(FLOWFIN_TUTORIAL_STEPS[0].id);
      setTargetRect(null);
      setResolvedTargetElement(null);
      setIsOpen(true);
    };

    globalThis.addEventListener(FLOWFIN_TUTORIAL_START_EVENT, handleManualStart);
    return () => {
      globalThis.removeEventListener(FLOWFIN_TUTORIAL_START_EVENT, handleManualStart);
    };
  }, [isAdmin, restartFromBeginning]);

  useEffect(() => {
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (rectTimeoutRef.current) {
      clearTimeout(rectTimeoutRef.current);
      rectTimeoutRef.current = null;
    }

    if (!isOpen || !step) return;

    setTargetRect(null);
    setResolvedTargetElement(null);

    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      return;
    }

    if (step.kind !== 'spotlight' || !step.target) return;

    let attempts = 0;

    retryTimerRef.current = setInterval(() => {
      const el = document.querySelector(step.target);

      if (el) {
        setResolvedTargetElement(el);
        scrollElementIntoContainerView(el);

        rectTimeoutRef.current = setTimeout(() => {
          rectTimeoutRef.current = null;
          setTargetRect(getRectWithViewportSupport(el));
        }, 280);

        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
        return;
      }

      attempts += 1;

      if (attempts >= TARGET_MAX_RETRIES) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
        setResolvedTargetElement(null);
        setTargetRect(null);
      }
    }, TARGET_RETRY_MS);

    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (rectTimeoutRef.current) {
        clearTimeout(rectTimeoutRef.current);
        rectTimeoutRef.current = null;
      }
    };
  }, [isOpen, step, location.pathname, navigate]);

  useEffect(() => {
    if (!isOpen || !resolvedTargetElement || step?.kind !== 'spotlight') return;

    const updateRect = () => {
      setTargetRect(getRectWithViewportSupport(resolvedTargetElement));
    };

    updateRect();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateRect())
        : null;

    if (resizeObserver) {
      resizeObserver.observe(resolvedTargetElement);
    }

    const scrollContainer = getScrollableContainer();
    const onScroll = () => updateRect();
    const onResize = () => updateRect();

    scrollContainer?.addEventListener?.('scroll', onScroll, { passive: true });
    globalThis.addEventListener('resize', onResize);
    globalThis.visualViewport?.addEventListener?.('resize', onResize);
    globalThis.visualViewport?.addEventListener?.('scroll', onScroll);

    return () => {
      resizeObserver?.disconnect();
      scrollContainer?.removeEventListener?.('scroll', onScroll);
      globalThis.removeEventListener('resize', onResize);
      globalThis.visualViewport?.removeEventListener?.('resize', onResize);
      globalThis.visualViewport?.removeEventListener?.('scroll', onScroll);
    };
  }, [isOpen, resolvedTargetElement, step?.kind]);

  useEffect(() => {
    if (!isOpen || !step?.id) return;
    void setCurrentStep(step.id);
  }, [isOpen, step?.id, setCurrentStep]);

  if (!isAdmin || !isOpen || !step) return null;

  const goToIndex = (index) => {
    const boundedIndex = Math.max(0, Math.min(index, FLOWFIN_TUTORIAL_STEPS.length - 1));
    const nextStep = FLOWFIN_TUTORIAL_STEPS[boundedIndex];

    setActiveStepId(nextStep.id);
    setTargetRect(null);
    setResolvedTargetElement(null);

    // Persist is fire-and-forget; navigation is handled by the step effect when
    // activeStepId changes, avoiding stale location.pathname closures.
    void setCurrentStep(nextStep.id);
  };

  const handleBack = () => {
    goToIndex(stepIndex - 1);
  };

  const handleNext = () => {
    if (step.isFinal) {
      markTutorialDone(membership?.id); // Sync write — survives refresh regardless of API
      sessionDismissedRef.current = true;
      setIsOpen(false);
      void markCompleted(); // Fire-and-forget backend persist
      return;
    }

    goToIndex(stepIndex + 1);
  };

  const handleLater = async () => {
    sessionDismissedRef.current = true;
    setIsOpen(false);

    toast({
      title: 'Tutorial pausado',
      description:
        'Tutorial pausado por ahora. Volverá a mostrarse en una nueva sesión, o puedes retomarlo desde Mi Familia.',
    });

    await markPostponed(step.id);
  };

  const handleSkip = () => {
    markTutorialDone(membership?.id); // Sync write — survives refresh regardless of API
    sessionDismissedRef.current = true;
    setIsOpen(false);

    toast({
      title: 'Tutorial omitido',
      description:
        'Tutorial omitido. Puedes volver a iniciarlo desde Mi Familia o consultar el Manual de Usuario cuando lo necesites.',
    });

    void markSkipped(step.id); // Fire-and-forget backend persist
  };

  return (
    <TutorialOverlay
      step={step}
      targetRect={targetRect}
      family={family}
      stepIndex={stepIndex}
      totalSteps={FLOWFIN_TUTORIAL_STEPS.length}
      canGoBack={stepIndex > 0}
      onBack={handleBack}
      onNext={handleNext}
      onLater={handleLater}
      onSkip={handleSkip}
      onClose={handleSkip}
    />
  );
}
