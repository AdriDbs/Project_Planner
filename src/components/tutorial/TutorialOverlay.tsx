import React, { useEffect } from 'react';
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

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') skip();
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isActive, next, prev, skip]);

  if (!isActive || !currentStep) return null;

  const padding = currentStep.padding ?? 8;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        pointerEvents: currentStep.position === 'center' ? 'all' : 'none',
      }}
    >
      {/* SVG backdrop with spotlight cutout */}
      <TutorialSpotlight targetRect={targetRect} padding={padding} />

      {/* Clickable backdrop when centered (no spotlight) */}
      {currentStep.position === 'center' && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 51 }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Tooltip */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none' }}>
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
