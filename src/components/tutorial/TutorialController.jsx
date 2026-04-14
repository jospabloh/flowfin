import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFamily } from '@/lib/FamilyContext';
import { useTutorialState } from '@/hooks/useTutorialState';
import {
  FLOWFIN_TUTORIAL_STEPS,
  getTutorialStepIndex,
} from '@/lib/tutorial/flowfinTutorialSteps';
import { FLOWFIN_TUTORIAL_START_EVENT } from '@/lib/tutorial/tutorialEvents';
import TutorialOverlay from './TutorialOverlay';

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
      Math.max(24, Math.min(120, window.innerHeight * 0.16));

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

  const viewportOffsetTop = window.visualViewport?.offsetTop || 0;
  const viewportOffsetLeft = window.visualViewport?.offsetLeft || 0;

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
  const { isAdmin, family } = useFamily();
  const {
    tutorialState,
    shouldAutoOpen,
    startOrResume,
    restartFromBeginning,
    setCurrentStep,
    markPostponed,
    markSkipped,
    markCompleted,
  } = useTutorialState();

  const location = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [activeStepId, setActiveStepId] = useState(tutorialState.current_step);
  const [targetRect, setTargetRect] = useState(null);
  const [resolvedTargetElement, setResolvedTargetElement] = useState(null);

  const retryTimerRef = useRef(null);
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

  // Reset session flags when family changes
  useEffect(() => {
    autoOpenAttemptedRef.current = false;
    sessionDismissedRef.current = false;
    setIsOpen(false);
    setTargetRect(null);
    setResolvedTargetElement(null);
  }, [family?.id]);

  // Auto-open: only once per session, only if not dismissed
  useEffect(() => {
    if (!isAdmin) return;
    if (autoOpenAttemptedRef.current) return;
    if (sessionDismissedRef.current) return;
    if (!shouldAutoOpen) return;

    autoOpenAttemptedRef.current = true;
    setIsOpen(true);
    void startOrResume();
  }, [isAdmin, shouldAutoOpen, startOrResume]);

  // Manual restart via event
  useEffect(() => {
    const handleManualStart = async () => {
      if (!isAdmin) return;

      sessionDismissedRef.current = false;
      autoOpenAttemptedRef.current = true;

      await restartFromBeginning();
      setActiveStepId('join-code');
      setTargetRect(null);
      setResolvedTargetElement(null);
      setIsOpen(true);
    };

    window.addEventListener(FLOWFIN_TUTORIAL_START_EVENT, handleManualStart);
    return () => {
      window.removeEventListener(FLOWFIN_TUTORIAL_START_EVENT, handleManualStart);
    };
  }, [isAdmin, restartFromBeginning]);

  // Target resolution
  useEffect(() => {
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
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

        setTimeout(() => {
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
    };
  }, [isOpen, step, location.pathname, navigate]);

  // Track rect changes on scroll/resize
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
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener?.('resize', onResize);
    window.visualViewport?.addEventListener?.('scroll', onScroll);

    return () => {
      resizeObserver?.disconnect();
      scrollContainer?.removeEventListener?.('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener?.('resize', onResize);
      window.visualViewport?.removeEventListener?.('scroll', onScroll);
    };
  }, [isOpen, resolvedTargetElement, step?.kind]);

  // Persist current step
  useEffect(() => {
    if (!isOpen || !step?.id) return;
    void setCurrentStep(step.id);
  }, [isOpen, step?.id, setCurrentStep]);

  if (!isAdmin || !isOpen || !step) return null;

  const goToIndex = async (index) => {
    const boundedIndex = Math.max(0, Math.min(index, FLOWFIN_TUTORIAL_STEPS.length - 1));
    const nextStep = FLOWFIN_TUTORIAL_STEPS[boundedIndex];

    setActiveStepId(nextStep.id);
    setTargetRect(null);
    setResolvedTargetElement(null);

    await setCurrentStep(nextStep.id);

    if (nextStep.route && location.pathname !== nextStep.route) {
      navigate(nextStep.route);
    }
  };

  const handleBack = async () => {
    await goToIndex(stepIndex - 1);
  };

  const handleNext = async () => {
    if (step.isFinal) {
      sessionDismissedRef.current = true;
      setIsOpen(false);
      await markCompleted();
      return;
    }

    await goToIndex(stepIndex + 1);
  };

  const handleLater = async () => {
    sessionDismissedRef.current = true;
    setIsOpen(false);
    await markPostponed(step.id);
  };

  const handleSkip = async () => {
    sessionDismissedRef.current = true;
    setIsOpen(false);
    await markSkipped(step.id);
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