import React from 'react';
import type { CommitmentType } from '../../types/lever';

interface BadgeProps {
  value: CommitmentType | string;
}

export function CommitmentBadge({ value }: BadgeProps) {
  const styles: Record<string, string> = {
    'Commitment': 'bg-green-100 text-green-800 border border-green-200',
    'Additional Potential': 'bg-blue-100 text-blue-800 border border-blue-200',
    'No Go': 'bg-red-100 text-red-800 border border-red-200',
  };
  return (
    <span className={`badge ${styles[value] || 'bg-gray-100 text-gray-700'}`}>
      {value}
    </span>
  );
}

interface ScoreBadgeProps {
  value: number;
  max?: number;
}

export function ScoreBadge({ value, max = 5 }: ScoreBadgeProps) {
  const pct = value / max;
  const color = pct >= 0.8 ? 'text-green-700' : pct >= 0.6 ? 'text-yellow-700' : 'text-red-600';
  return (
    <span className={`font-semibold ${color}`}>
      {value}/{max}
    </span>
  );
}
