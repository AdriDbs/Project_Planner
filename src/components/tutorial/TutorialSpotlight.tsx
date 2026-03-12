import React, { useId } from 'react';

interface TutorialSpotlightProps {
  targetRect: DOMRect | null;
  padding?: number;
  strokeColor?: string;
  strokeWidth?: number;
  isFlashing?: boolean;
  onOverlayClick?: () => void;
  allowInteraction?: boolean;
}

export function TutorialSpotlight({
  targetRect,
  padding = 8,
  strokeColor = '#FFFFFF',
  strokeWidth = 1.5,
  isFlashing = false,
  onOverlayClick,
  allowInteraction = false,
}: TutorialSpotlightProps) {
  const maskId = useId();

  const spotlight = targetRect
    ? {
        x: targetRect.left - padding,
        y: targetRect.top - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
        rx: 8,
      }
    : null;

  const overlayFill = isFlashing
    ? 'rgba(255,98,0,0.25)'
    : 'rgba(0,0,0,0.60)';

  const pulseDur = allowInteraction ? '0.6s' : '1.2s';
  const pulseValues = allowInteraction ? '1;0.4;1' : '0.8;0.3;0.8';

  return (
    <svg
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 9997,
        // When allowInteraction: SVG is fully transparent to pointer events.
        // The document-level capture listener in TutorialOverlay handles blocking.
        // When !allowInteraction: SVG captures all clicks (including the masked
        // "transparent" spotlight area — SVG masks don't affect pointer events).
        pointerEvents: allowInteraction ? 'none' : 'all',
      }}
    >
      <defs>
        <mask id={maskId}>
          <rect width="100%" height="100%" fill="white" />
          {spotlight && (
            <rect
              x={spotlight.x}
              y={spotlight.y}
              width={spotlight.width}
              height={spotlight.height}
              rx={spotlight.rx}
              fill="black"
              style={{ transition: 'all 350ms ease' }}
            />
          )}
        </mask>
      </defs>
      {/* Dark overlay — captures clicks when !allowInteraction */}
      <rect
        width="100%"
        height="100%"
        fill={overlayFill}
        mask={`url(#${maskId})`}
        style={{ pointerEvents: 'all', transition: 'fill 0.3s ease' }}
        onClick={(e) => {
          e.stopPropagation();
          onOverlayClick?.();
        }}
      />
      {/* Spotlight border */}
      {spotlight && (
        <rect
          x={spotlight.x}
          y={spotlight.y}
          width={spotlight.width}
          height={spotlight.height}
          rx={spotlight.rx}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          style={{
            transition: 'all 350ms ease',
            filter: `drop-shadow(0 0 6px ${strokeColor}99)`,
            pointerEvents: 'none',
          }}
        >
          <animate
            attributeName="stroke-opacity"
            values={pulseValues}
            dur={pulseDur}
            repeatCount="indefinite"
          />
        </rect>
      )}
    </svg>
  );
}
