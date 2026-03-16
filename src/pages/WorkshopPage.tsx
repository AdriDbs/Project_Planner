import React from 'react';
import { Plus, PlayCircle, Eye, Clock, CheckCircle, FileText } from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { useWorkshopStore } from '../store/workshopStore';
import { useWorkshops } from '../hooks/useWorkshops';
import { useProjectStore } from '../store/projectStore';
import { usePlants } from '../hooks/useProjects';
import type { Workshop } from '../types/workshop';

function statusIcon(status: Workshop['status']) {
  switch (status) {
    case 'completed':  return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'in_progress': return <Clock className="w-4 h-4 text-yellow-400" />;
    default:           return <FileText className="w-4 h-4 text-gray-400" />;
  }
}

function statusLabel(status: Workshop['status']) {
  switch (status) {
    case 'completed':   return 'Terminé';
    case 'in_progress': return 'En cours';
    default:            return 'Brouillon';
  }
}

const PHASE_LABELS: Record<string, string> = {
  setup:        'Phase 1 — Setup',
  lever_library:'Phase 2 — Bibliothèque',
  selection:    'Phase 3 — Sélection',
  scoring:      'Phase 4 — Scoring',
  commitment:   'Phase 5 — Commitment',
  synthesis:    'Phase 6 — Synthèse',
};

export function WorkshopCoConstructionPage() {
  const { selectedProjectId } = useProjectStore();
  const { setCoConstructionMode } = useWorkshopStore();
  const { workshops, loading } = useWorkshops(selectedProjectId);
  const { plants } = usePlants(selectedProjectId);

  const handleNew = () => {
    setCoConstructionMode(true);
  };

  const handleResume = (workshop: Workshop) => {
    setCoConstructionMode(true, workshop.id);
  };

  const getPlantName = (plantId: string) =>
    plants.find(p => p.id === plantId)?.name || plantId;

  const getSelectedCount = (w: Workshop) =>
    Object.values(w.leverSelections || {}).filter(s => s.selected).length;

  return (
    <PageWrapper>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workshops Co-construction</h1>
            <p className="text-gray-500 text-sm mt-1">
              Animez des ateliers collaboratifs de sélection et scoring des leviers de performance.
            </p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 bg-[#e8451a] hover:bg-[#d03d16] text-white rounded-xl px-5 py-2.5 font-medium transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            Nouveau Workshop
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : workshops.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucun workshop pour ce projet</p>
            <p className="text-gray-400 text-sm mt-1 mb-6">
              Créez votre premier workshop pour commencer la co-construction.
            </p>
            <button
              onClick={handleNew}
              className="inline-flex items-center gap-2 bg-[#e8451a] hover:bg-[#d03d16] text-white rounded-xl px-5 py-2.5 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouveau Workshop
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {workshops
              .slice()
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(workshop => (
                <div
                  key={workshop.id}
                  className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-[#e8451a]/40 transition-colors shadow-sm"
                >
                  <div className="flex-shrink-0">{statusIcon(workshop.status)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-900 font-semibold text-sm">{workshop.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        workshop.status === 'completed'
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : workshop.status === 'in_progress'
                            ? 'border-yellow-200 bg-yellow-50 text-yellow-700'
                            : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}>
                        {statusLabel(workshop.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>{new Date(workshop.date).toLocaleDateString('fr-FR')}</span>
                      <span>·</span>
                      <span>{getPlantName(workshop.plantId)}</span>
                      <span>·</span>
                      <span>{getSelectedCount(workshop)} levier(s) sélectionné(s)</span>
                      <span>·</span>
                      <span>{PHASE_LABELS[workshop.currentPhase] || workshop.currentPhase}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {workshop.status !== 'completed' && (
                      <button
                        onClick={() => handleResume(workshop)}
                        className="flex items-center gap-1.5 bg-[#e8451a]/10 hover:bg-[#e8451a]/20 text-[#e8451a] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border border-[#e8451a]/20"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        Reprendre
                      </button>
                    )}
                    {workshop.status === 'completed' && (
                      <button
                        onClick={() => handleResume(workshop)}
                        className="flex items-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border border-green-200"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Voir synthèse
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
