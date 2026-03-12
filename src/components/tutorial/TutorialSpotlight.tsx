import React, { useId } from 'react';

interface TutorialSpotlightProps {
  targetRect: DOMRect | null;
  padding?: number;
}

export function TutorialSpotlight({ targetRect, padding = 8 }: TutorialSpotlightProps) {
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

  return (
    <svg
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 50,
        pointerEvents: 'none',
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
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.6)"
        mask={`url(#${maskId})`}
      />
      {spotlight && (
        <rect
          x={spotlight.x}
          y={spotlight.y}
          width={spotlight.width}
          height={spotlight.height}
          rx={spotlight.rx}
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="2"
          style={{
            transition: 'all 350ms ease',
            filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.6))',
          }}
        >
          <animate
            attributeName="stroke-opacity"
            values="0.8;0.3;0.8"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </rect>
      )}
    </svg>
  );
}
