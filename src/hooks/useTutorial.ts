import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TUTORIAL_STEPS } from '../data/tutorialSteps';
import { useProjectStore } from '../store/projectStore';

export function useTutorial() {
  const navigate = useNavigate();
  const { tutorialActive, tutorialStep, startTutorial, setTutorialActive, setTutorialStep } =
    useProjectStore();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = TUTORIAL_STEPS[tutorialStep] ?? TUTORIAL_STEPS[0];

  const measureTarget = useCallback(() => {
    if (!currentStep?.target) {
      setTargetRect(null);
      return;
    }

    let attempts = 0;
    const interval = setInterval(() => {
      const el = document.querySelector(currentStep.target!);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
        clearInterval(interval);
      }
      if (++attempts > 20) {
        setTargetRect(null);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [currentStep]);

  const start = useCallback(() => {
    startTutorial();
  }, [startTutorial]);

  const next = useCallback(async () => {
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
      setTutorialActive(false);
      localStorage.setItem('bp_tutorial_done', 'true');
      return;
    }
    const nextStep = TUTORIAL_STEPS[tutorialStep + 1];

    if (nextStep.beforeAction?.type === 'navigate') {
      navigate(nextStep.beforeAction.to);
      await new Promise<void>((r) => setTimeout(r, 300));
    }

    setTutorialStep(tutorialStep + 1);
  }, [tutorialStep, navigate, setTutorialActive, setTutorialStep]);

  const prev = useCallback(async () => {
    if (tutorialStep <= 0) return;
    const prevStep = TUTORIAL_STEPS[tutorialStep - 1];

    if (prevStep.beforeAction?.type === 'navigate') {
      navigate(prevStep.beforeAction.to);
      await new Promise<void>((r) => setTimeout(r, 300));
    }

    setTutorialStep(tutorialStep - 1);
  }, [tutorialStep, navigate, setTutorialStep]);

  const skip = useCallback(() => {
    setTutorialActive(false);
    localStorage.setItem('bp_tutorial_skipped', 'true');
  }, [setTutorialActive]);

  // Re-measure when step changes or window is resized
  useEffect(() => {
    if (!tutorialActive) return;
    const cleanup = measureTarget();
    window.addEventListener('resize', measureTarget);
    return () => {
      window.removeEventListener('resize', measureTarget);
      cleanup?.();
    };
  }, [tutorialActive, tutorialStep, measureTarget]);

  // Auto-start on first visit
  useEffect(() => {
    if (
      !localStorage.getItem('bp_tutorial_done') &&
      !localStorage.getItem('bp_tutorial_skipped')
    ) {
      const t = setTimeout(() => start(), 1500);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isActive: tutorialActive,
    currentStep,
    currentIndex: tutorialStep,
    totalSteps: TUTORIAL_STEPS.length,
    targetRect,
    start,
    next,
    prev,
    skip,
    chapterName: currentStep?.chapter,
    chapterIndex: currentStep?.chapterIndex,
    totalChapters: 10,
    progress: tutorialStep / (TUTORIAL_STEPS.length - 1),
  };
}
