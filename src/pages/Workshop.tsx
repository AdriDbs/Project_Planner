import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useProjectStore } from '../store/projectStore';
import { useProjects, usePlants } from '../hooks/useProjects';
import { useWorkshopSession } from '../hooks/useWorkshopSession';
import { WorkshopHeader, WorkshopNav } from '../components/workshop/shared/WorkshopNav';
import { Phase1_Context } from '../components/workshop/phases/Phase1_Context';
import { Phase2_LeverReview } from '../components/workshop/phases/Phase2_LeverReview';
import { Phase3_NewLevers } from '../components/workshop/phases/Phase3_NewLevers';
import { Phase4_Prioritization } from '../components/workshop/phases/Phase4_Prioritization';
import { Phase5_Roadmap } from '../components/workshop/phases/Phase5_Roadmap';
import { Phase6_Synthesis } from '../components/workshop/phases/Phase6_Synthesis';

export function WorkshopPage() {
  const navigate = useNavigate();
  const { selectedProjectId, selectedYears } = useProjectStore();
  const { projects } = useProjects();
  const { plants } = usePlants(selectedProjectId);
  const {
    session,
    levers,
    baselines,
    decisions,
    newLevers,
    computedSavings,
    leversByQuadrant,
    currentPhase,
    pauseSession,
    completeSession,
    setPhase,
    makeDecision,
    createNewLever,
    updateNewLever,
    deleteNewLever,
    updateSessionField,
  } = useWorkshopSession(selectedProjectId);

  const project = projects.find(p => p.id === selectedProjectId);
  const projectYears = project?.years ?? selectedYears;

  // Redirect if no session
  useEffect(() => {
    if (!selectedProjectId || !session) {
      navigate('/');
    }
  }, [selectedProjectId, session, navigate]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' && canGoNext) goNext();
      if (e.key === 'ArrowLeft' && canGoPrev) goPrev();
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const canGoPrev = currentPhase > 1;
  const canGoNext = (() => {
    if (currentPhase === 1) return (session?.clientPriorities?.length ?? 0) > 0;
    return true;
  })();

  const goPrev = () => {
    if (canGoPrev) setPhase((currentPhase - 1) as 1 | 2 | 3 | 4 | 5 | 6);
  };

  const goNext = async () => {
    if (currentPhase === 6) {
      await completeSession();
      handleClose();
      return;
    }
    if (canGoNext) setPhase((currentPhase + 1) as 1 | 2 | 3 | 4 | 5 | 6);
  };

  const handlePause = async () => {
    await pauseSession();
    // Show pause screen
    document.exitFullscreen?.().catch(() => {});
    navigate('/');
    toast('Atelier mis en pause. Vous pouvez le reprendre depuis le lanceur.', { icon: '⏸' });
  };

  const handleClose = () => {
    if (!confirm('Quitter l\'atelier ? La session sera sauvegardée et vous pourrez la reprendre.')) return;
    pauseSession();
    document.exitFullscreen?.().catch(() => {});
    navigate('/');
  };

  if (!session || !project) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#003057]">
        <div className="text-white text-center">
          <div className="text-2xl mb-2">Chargement de l'atelier...</div>
          <div className="text-white/60 text-sm">Connexion Firestore en cours</div>
        </div>
      </div>
    );
  }

  const handleMakeDecision = (leverId: string, updates: any) => {
    makeDecision(leverId, updates);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 min-w-[1280px]">
      {/* Header */}
      <WorkshopHeader
        session={session}
        projectName={project.name}
        onClose={handleClose}
      />

      {/* Phase content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {currentPhase === 1 && (
          <Phase1_Context
            session={session}
            levers={levers}
            baselines={baselines}
            plants={plants}
            onUpdateSession={updateSessionField}
            onNext={goNext}
          />
        )}

        {currentPhase === 2 && (
          <Phase2_LeverReview
            session={session}
            levers={levers}
            decisions={decisions}
            computedSavings={computedSavings}
            projectYears={projectYears}
            onMakeDecision={handleMakeDecision}
          />
        )}

        {currentPhase === 3 && (
          <Phase3_NewLevers
            session={session}
            plants={plants}
            newLevers={newLevers}
            computedSavings={computedSavings}
            projectYears={projectYears}
            onCreateLever={createNewLever}
            onUpdateLever={updateNewLever}
            onDeleteLever={deleteNewLever}
            onNext={goNext}
          />
        )}

        {currentPhase === 4 && (
          <Phase4_Prioritization
            session={session}
            leversByQuadrant={leversByQuadrant}
            debatedCount={computedSavings.debatedCount}
            libraryCount={Object.values(decisions).filter(d => d.status === 'validated').length}
            terrainCount={newLevers.length}
            onBack={() => setPhase(2)}
          />
        )}

        {currentPhase === 5 && (
          <Phase5_Roadmap
            session={session}
            levers={levers}
            decisions={decisions}
            newLevers={newLevers}
            projectYears={projectYears}
            onUpdateDecision={handleMakeDecision}
            onUpdateNewLever={updateNewLever}
            onUpdateSession={updateSessionField}
          />
        )}

        {currentPhase === 6 && (
          <Phase6_Synthesis
            session={session}
            project={project}
            levers={levers}
            decisions={decisions}
            newLevers={newLevers}
            computedSavings={computedSavings}
            plants={plants}
            projectYears={projectYears}
            onComplete={async () => {
              await completeSession();
              handleClose();
            }}
          />
        )}
      </div>

      {/* Nav footer */}
      <WorkshopNav
        session={session}
        onPrev={goPrev}
        onNext={goNext}
        onPause={handlePause}
        onClose={handleClose}
        canGoNext={canGoNext}
        canGoPrev={canGoPrev}
      />
    </div>
  );
}
