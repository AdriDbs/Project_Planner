import React from 'react';
import { ChevronLeft, ChevronRight, Pause, Users, X } from 'lucide-react';
import type { WorkshopSession } from '../../../types/workshop';

interface WorkshopNavProps {
  session: WorkshopSession;
  onPrev: () => void;
  onNext: () => void;
  onPause: () => void;
  onClose: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
}

const PHASE_LABELS = [
  'Contexte & Ambition',
  'Revue des leviers',
  'Nouveaux leviers',
  'Priorisation',
  'Roadmap',
  'Synthèse',
];

export function WorkshopNav({
  session,
  onPrev,
  onNext,
  onPause,
  onClose,
  canGoNext,
  canGoPrev,
}: WorkshopNavProps) {
  const remoteCount = session.participants.filter(p => p.isRemote).length;
  const onlineCount = session.participants.length;

  return (
    <div className="h-14 bg-white border-t border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: Prev */}
      <button
        onClick={onPrev}
        disabled={!canGoPrev}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={16} />
        Précédent
      </button>

      {/* Center: Pause + Participants */}
      <div className="flex items-center gap-4">
        <button
          onClick={onPause}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
        >
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Pause
        </button>
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Users size={15} />
          <span>{onlineCount} participant{onlineCount > 1 ? 's' : ''}</span>
          {remoteCount > 0 && (
            <span className="text-amber-500">({remoteCount} distant{remoteCount > 1 ? 's' : ''})</span>
          )}
        </div>
      </div>

      {/* Right: Next */}
      <button
        onClick={onNext}
        disabled={!canGoNext}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-bp-primary hover:bg-bp-primary/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
      >
        {session.currentPhase === 6 ? 'Terminer' : 'Suivant'}
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

interface WorkshopHeaderProps {
  session: WorkshopSession;
  projectName: string;
  onClose: () => void;
}

export function WorkshopHeader({ session, projectName, onClose }: WorkshopHeaderProps) {
  return (
    <div className="h-14 bg-[#003057] flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div className="text-white font-bold text-sm">BearingPoint</div>
        <span className="text-white/30">|</span>
        <span className="text-white/80 text-sm">
          {session.clientName} — {projectName}
        </span>
      </div>

      {/* Center: Phase stepper */}
      <div className="flex items-center gap-2">
        {PHASE_LABELS.map((label, idx) => {
          const phaseNum = idx + 1;
          const isActive = phaseNum === session.currentPhase;
          const isDone = phaseNum < session.currentPhase;
          return (
            <div key={phaseNum} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-3 h-3 rounded-full transition-all ${
                    isActive
                      ? 'bg-white scale-125'
                      : isDone
                      ? 'bg-white/60'
                      : 'bg-white/20'
                  }`}
                />
                {isActive && (
                  <span className="text-white text-xs font-medium hidden lg:block">
                    {label}
                  </span>
                )}
              </div>
              {idx < 5 && (
                <div className={`w-6 h-px ${isDone ? 'bg-white/50' : 'bg-white/20'}`} />
              )}
            </div>
          );
        })}
        <span className="text-white/60 text-xs ml-2">
          Phase {session.currentPhase}/6
        </span>
      </div>

      {/* Right: Close */}
      <button
        onClick={onClose}
        className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        title="Quitter l'atelier"
      >
        <X size={18} />
      </button>
    </div>
  );
}
