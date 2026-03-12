import React, { useEffect, useState, useCallback } from 'react';
import { useTutorial } from '../../hooks/useTutorial';
import { TutorialSpotlight } from './TutorialSpotlight';
import { TutorialTooltip } from './TutorialTooltip';
import { TutorialProgress } from './TutorialProgress';

export function TutorialOverlay() {
  const {
    isActive,
    currentStep,
    currentIndex,
    totalSteps,
    targetRect,
    next,
    prev,
    skip,
    chapterName,
    chapterIndex,
    totalChapters,
    progress,
  } = useTutorial();

  const [isFlashing, setIsFlashing] = useState(false);

  const flashOverlay = useCallback(() => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 300);
  }, []);

  // Keyboard navigation + Tab blocking
  useEffect(() => {
    if (!isActive) return;

    const blockKeys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { next(); return; }
      if (e.key === 'ArrowLeft') { prev(); return; }
      if (e.key === 'Escape') { skip(); return; }
      // Block Tab to prevent focus leaving the tutorial
      if (e.key === 'Tab') {
        e.preventDefault();
        return;
      }
      // If the step allows interaction, let other keys through
      if (currentStep?.allowInteraction) return;
    };

    document.addEventListener('keydown', blockKeys, true);
    return () => document.removeEventListener('keydown', blockKeys, true);
  }, [isActive, currentStep, next, prev, skip]);

  // Block all pointer events except tutorial controls and spotlight (if allowInteraction)
  useEffect(() => {
    if (!isActive || !currentStep) return;

    const blockClicks = (e: MouseEvent) => {
      const target = e.target as Element;

      // Always allow tutorial navigation buttons
      if (target.closest('[data-tutorial-nav]')) return;

      // Allow the close button
      if (target.closest('[data-tutorial-close]')) return;

      // If the step allows interaction with the spotlight element
      if (currentStep.allowInteraction && currentStep.target) {
        const spotlightEl = document.querySelector(currentStep.target);
        if (spotlightEl && spotlightEl.contains(target)) return;
      }

      // Block everything else
      e.stopPropagation();
      e.preventDefault();
      flashOverlay();
    };

    document.addEventListener('click', blockClicks, true);
    document.addEventListener('mousedown', blockClicks, true);
    document.addEventListener('touchstart', blockClicks, { capture: true, passive: false });

    return () => {
      document.removeEventListener('click', blockClicks, true);
      document.removeEventListener('mousedown', blockClicks, true);
      document.removeEventListener('touchstart', blockClicks, true);
    };
  }, [isActive, currentStep, flashOverlay]);

  if (!isActive || !currentStep) return null;

  const padding = currentStep.padding ?? 8;
  const spotlightStrokeColor = currentStep.allowInteraction ? '#FF6200' : '#FFFFFF';
  const spotlightStrokeWidth = currentStep.allowInteraction ? 2.5 : 1.5;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9996,
        pointerEvents: 'none',
      }}
    >
      {/* SVG backdrop with spotlight cutout — captures clicks on dark area */}
      <TutorialSpotlight
        targetRect={targetRect}
        padding={padding}
        strokeColor={spotlightStrokeColor}
        strokeWidth={spotlightStrokeWidth}
        isFlashing={isFlashing}
        onOverlayClick={flashOverlay}
        allowInteraction={currentStep.allowInteraction}
      />

      {/* Interaction hint badge under spotlight when allowInteraction */}
      {currentStep.allowInteraction && targetRect && (
        <div
          style={{
            position: 'fixed',
            left: targetRect.left + targetRect.width / 2,
            top: targetRect.bottom + 12,
            transform: 'translateX(-50%)',
            zIndex: 10001,
            pointerEvents: 'none',
          }}
          className="bg-bp-secondary text-white text-xs px-3 py-1 rounded-full font-semibold shadow-lg animate-bounce"
        >
          {currentStep.advanceOnInteraction ? '👆 Cliquez pour continuer' : '👆 Interagissez ici'}
        </div>
      )}

      {/* Tooltip */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
        <TutorialTooltip
          step={currentStep}
          currentIndex={currentIndex}
          totalSteps={totalSteps}
          targetRect={targetRect}
          onNext={next}
          onPrev={prev}
          onSkip={skip}
        />
      </div>

      {/* Progress bar */}
      <TutorialProgress
        currentIndex={currentIndex}
        totalSteps={totalSteps}
        chapterName={chapterName ?? ''}
        chapterIndex={chapterIndex ?? 1}
        totalChapters={totalChapters}
        progress={progress}
      />
    </div>
  );
}
