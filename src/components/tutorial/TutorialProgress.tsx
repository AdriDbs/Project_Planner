import React from 'react';

interface TutorialProgressProps {
  currentIndex: number;
  totalSteps: number;
  chapterName: string;
  chapterIndex: number;
  totalChapters: number;
  progress: number;
}

export function TutorialProgress({
  currentIndex,
  totalSteps,
  chapterName,
  chapterIndex,
  totalChapters,
  progress,
}: TutorialProgressProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        pointerEvents: 'none',
      }}
      className="flex flex-col items-center gap-2"
    >
      <div className="bg-black/70 backdrop-blur-sm text-white/70 text-xs px-4 py-1.5 rounded-full whitespace-nowrap">
        Étape{' '}
        <span className="text-white font-semibold">{currentIndex + 1}</span>
        {' / '}
        <span>{totalSteps}</span>
        {' — Chapitre '}
        <span className="text-white font-semibold">{chapterIndex}/{totalChapters}</span>
        {' : '}
        <span className="text-white">{chapterName}</span>
      </div>
      <div className="w-64 h-1 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-bp-secondary rounded-full"
          style={{
            width: `${progress * 100}%`,
            transition: 'width 350ms ease',
          }}
        />
      </div>
    </div>
  );
}
