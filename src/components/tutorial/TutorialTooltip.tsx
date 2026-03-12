import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { TooltipPosition, TutorialStep } from '../../types/tutorial';

const TOOLTIP_WIDTH = 360;
const TOOLTIP_MAX_HEIGHT = 300;
const ARROW_SIZE = 8;
const MARGIN = 16;

function computeTooltipStyle(
  rect: DOMRect | null,
  position: TooltipPosition,
  padding: number = 8
): React.CSSProperties {
  if (!rect || position === 'center') {
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: TOOLTIP_WIDTH + 40,
    };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top: number;
  let left: number;

  switch (position) {
    case 'bottom':
      top = rect.bottom + padding + ARROW_SIZE;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case 'top':
      top = rect.top - padding - ARROW_SIZE - TOOLTIP_MAX_HEIGHT;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case 'right':
      top = rect.top + rect.height / 2 - TOOLTIP_MAX_HEIGHT / 2;
      left = rect.right + padding + ARROW_SIZE;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - TOOLTIP_MAX_HEIGHT / 2;
      left = rect.left - padding - ARROW_SIZE - TOOLTIP_WIDTH;
      break;
    default:
      top = vh / 2 - TOOLTIP_MAX_HEIGHT / 2;
      left = vw / 2 - TOOLTIP_WIDTH / 2;
  }

  left = Math.max(MARGIN, Math.min(left, vw - TOOLTIP_WIDTH - MARGIN));
  top = Math.max(MARGIN, Math.min(top, vh - TOOLTIP_MAX_HEIGHT - MARGIN));

  return { position: 'fixed', top, left, width: TOOLTIP_WIDTH };
}

function getArrowStyle(
  rect: DOMRect | null,
  position: TooltipPosition,
  tooltipStyle: React.CSSProperties
): React.CSSProperties | null {
  if (!rect || position === 'center') return null;

  const base: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
  };

  const tooltipLeft = typeof tooltipStyle.left === 'number' ? tooltipStyle.left : 0;

  switch (position) {
    case 'bottom': {
      const arrowLeft = rect.left + rect.width / 2 - tooltipLeft;
      return {
        ...base,
        top: -ARROW_SIZE,
        left: Math.max(12, Math.min(arrowLeft - ARROW_SIZE, TOOLTIP_WIDTH - 28)),
        borderLeft: `${ARROW_SIZE}px solid transparent`,
        borderRight: `${ARROW_SIZE}px solid transparent`,
        borderBottom: `${ARROW_SIZE}px solid white`,
      };
    }
    case 'top': {
      const arrowLeft = rect.left + rect.width / 2 - tooltipLeft;
      return {
        ...base,
        bottom: -ARROW_SIZE,
        left: Math.max(12, Math.min(arrowLeft - ARROW_SIZE, TOOLTIP_WIDTH - 28)),
        borderLeft: `${ARROW_SIZE}px solid transparent`,
        borderRight: `${ARROW_SIZE}px solid transparent`,
        borderTop: `${ARROW_SIZE}px solid white`,
      };
    }
    case 'right':
      return {
        ...base,
        top: '50%',
        left: -ARROW_SIZE,
        transform: 'translateY(-50%)',
        borderTop: `${ARROW_SIZE}px solid transparent`,
        borderBottom: `${ARROW_SIZE}px solid transparent`,
        borderRight: `${ARROW_SIZE}px solid white`,
      };
    case 'left':
      return {
        ...base,
        top: '50%',
        right: -ARROW_SIZE,
        transform: 'translateY(-50%)',
        borderTop: `${ARROW_SIZE}px solid transparent`,
        borderBottom: `${ARROW_SIZE}px solid transparent`,
        borderLeft: `${ARROW_SIZE}px solid white`,
      };
    default:
      return null;
  }
}

function parseContent(content: string): React.ReactNode[] {
  return content.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    return (
      <span key={i} className={i > 0 ? 'block mt-1' : ''}>
        {parts}
      </span>
    );
  });
}

interface TutorialTooltipProps {
  step: TutorialStep;
  currentIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

export function TutorialTooltip({
  step,
  currentIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
}: TutorialTooltipProps) {
  const tooltipStyle = computeTooltipStyle(targetRect, step.position, step.padding);
  const arrowStyle = getArrowStyle(targetRect, step.position, tooltipStyle);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        style={{
          ...tooltipStyle,
          zIndex: 60,
          pointerEvents: 'all',
        }}
        className="bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Arrow */}
        {arrowStyle && <div style={arrowStyle} />}

        {/* Header */}
        <div className="bg-bp-primary px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-bp-secondary text-xs font-semibold uppercase tracking-wider mb-1">
                Chapitre {step.chapterIndex} — {step.chapter}
              </p>
              <h3 className="text-white font-bold text-base leading-snug">{step.title}</h3>
            </div>
            <button
              onClick={onSkip}
              className="text-white/40 hover:text-white/80 transition-colors mt-0.5 flex-shrink-0"
              title="Fermer le tutoriel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3 text-gray-700 text-sm leading-relaxed">
          {parseContent(step.content)}
        </div>

        {/* Navigation */}
        <div className="px-4 pb-4 flex items-center justify-between gap-2">
          <button
            onClick={onPrev}
            disabled={isFirst}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Précédent
          </button>

          <button
            onClick={onSkip}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Passer
          </button>

          <button
            onClick={onNext}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm bg-bp-secondary text-white hover:bg-bp-secondary/90 transition-colors font-medium"
          >
            {isLast ? 'Terminer' : 'Suivant'}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
