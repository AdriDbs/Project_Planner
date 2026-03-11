import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Wifi, WifiOff, Users, ChevronRight, ChevronLeft, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WorkshopSession, WorkshopParticipant } from '../../types/workshop';
import type { Project, Plant } from '../../types/project';
import type { Lever } from '../../types/lever';
import { useWorkshopSession } from '../../hooks/useWorkshopSession';

interface WorkshopLauncherProps {
  project: Project;
  plants: Plant[];
  onClose: () => void;
}

type Step = 1 | 2;

export function WorkshopLauncher({ project, plants, onClose }: WorkshopLauncherProps) {
  const navigate = useNavigate();
  const { session, createSession, resumeSession } = useWorkshopSession(project.id);
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [clientName, setClientName] = useState(project.client ?? '');
  const [facilitator, setFacilitator] = useState('');
  const [workshopDate, setWorkshopDate] = useState(new Date().toISOString().slice(0, 10));
  const [participants, setParticipants] = useState<WorkshopParticipant[]>([
    { name: '', role: '', isRemote: false }
  ]);

  // Step 2 state
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>(plants.map(p => p.id));
  const [leverScope, setLeverScope] = useState<'all' | 'project' | 'manual'>('project');
  const [availableLevers, setAvailableLevers] = useState<Lever[]>([]);
  const [selectedLeverIds, setSelectedLeverIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Load levers for project
  useEffect(() => {
    getDocs(query(collection(db, 'levers'), where('projectId', '==', project.id)))
      .then(snap => {
        const levers = snap.docs.map(d => ({ id: d.id, ...d.data() } as Lever));
        setAvailableLevers(levers);
        setSelectedLeverIds(new Set(levers.map(l => l.id)));
      });
  }, [project.id]);

  // Estimated duration
  const estimatedLevers = leverScope === 'all'
    ? availableLevers.length
    : leverScope === 'project'
    ? availableLevers.length
    : selectedLeverIds.size;
  const estimatedMinutes = estimatedLevers * 3 + 45;

  const addParticipant = () => {
    setParticipants(p => [...p, { name: '', role: '', isRemote: false }]);
  };

  const updateParticipant = (idx: number, updates: Partial<WorkshopParticipant>) => {
    setParticipants(p => p.map((part, i) => i === idx ? { ...part, ...updates } : part));
  };

  const removeParticipant = (idx: number) => {
    setParticipants(p => p.filter((_, i) => i !== idx));
  };

  const togglePlant = (id: string) => {
    setSelectedPlantIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleLever = (id: string) => {
    setSelectedLeverIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const canProceed = facilitator.trim() &&
    participants.some(p => p.name.trim()) &&
    selectedPlantIds.length > 0;

  const handleLaunch = async () => {
    if (!canProceed) return;
    setLoading(true);
    try {
      const cleanParticipants = participants.filter(p => p.name.trim());
      await createSession({
        clientName,
        facilitator,
        workshopDate,
        participants: cleanParticipants,
        selectedPlantIds,
      });

      // Request fullscreen
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {
        // Ignore fullscreen errors
      }

      navigate('/workshop');
      onClose();
      toast.success('Atelier démarré !');
    } catch (e) {
      toast.error('Erreur lors du démarrage');
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    if (!session) return;
    try {
      await resumeSession(session.id);
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {}
      navigate('/workshop');
      onClose();
    } catch (e) {
      toast.error('Erreur lors de la reprise');
    }
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-secondary";

  return (
    <div className="space-y-6">
      {/* Paused session banner */}
      {session?.status === 'paused' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800">
                Une session du {new Date(session.startedAt).toLocaleDateString('fr-FR')} est en cours
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Phase {session.currentPhase}/6 · {session.participants?.length ?? 0} participants</p>
            </div>
            <button
              onClick={handleResume}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              <Clock size={15} /> Reprendre
            </button>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {[1, 2].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              step === s ? 'bg-bp-primary text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {s}
            </div>
            <span className={`text-sm ${step === s ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
              {s === 1 ? 'Contexte' : 'Périmètre'}
            </span>
            {s < 2 && <ChevronRight size={14} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom du client</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Facilitateur BearingPoint *</label>
            <input value={facilitator} onChange={e => setFacilitator(e.target.value)} className={inputCls} placeholder="ex. Jean Dupont" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date de l'atelier</label>
            <input type="date" value={workshopDate} onChange={e => setWorkshopDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Participants</label>
              <button onClick={addParticipant} className="flex items-center gap-1 text-xs text-bp-secondary hover:text-bp-primary">
                <Plus size={12} /> Ajouter
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {participants.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={p.name}
                    onChange={e => updateParticipant(idx, { name: e.target.value })}
                    className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-bp-secondary"
                    placeholder="Nom"
                  />
                  <input
                    value={p.role}
                    onChange={e => updateParticipant(idx, { role: e.target.value })}
                    className="w-28 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-bp-secondary"
                    placeholder="Rôle"
                  />
                  <button
                    onClick={() => updateParticipant(idx, { isRemote: !p.isRemote })}
                    title={p.isRemote ? 'Distant' : 'Présentiel'}
                    className={`p-1.5 rounded-lg transition-colors ${p.isRemote ? 'text-amber-500 bg-amber-50' : 'text-green-500 bg-green-50'}`}
                  >
                    {p.isRemote ? <WifiOff size={14} /> : <Wifi size={14} />}
                  </button>
                  {participants.length > 1 && (
                    <button onClick={() => removeParticipant(idx)} className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
              Annuler
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!facilitator.trim() || !participants.some(p => p.name.trim())}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-bp-primary text-white font-semibold rounded-xl text-sm disabled:opacity-50 hover:bg-bp-primary/90 transition-colors"
            >
              Suivant <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {/* Plants */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Usines à inclure</label>
            <div className="space-y-2">
              {plants.map(plant => (
                <label key={plant.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlantIds.includes(plant.id)}
                    onChange={() => togglePlant(plant.id)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">{plant.name}</span>
                  <span className="text-xs text-gray-400">{plant.code}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Lever scope */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Leviers à inclure</label>
            <div className="space-y-2">
              {[
                { value: 'all', label: 'Tous les leviers in scope de la bibliothèque' },
                { value: 'project', label: 'Uniquement les leviers déjà dans ce projet' },
                { value: 'manual', label: 'Sélection manuelle' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={opt.value}
                    checked={leverScope === opt.value as 'all' | 'project' | 'manual'}
                    onChange={() => setLeverScope(opt.value as 'all' | 'project' | 'manual')}
                    className="rounded-full"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Manual lever selection */}
          {leverScope === 'manual' && availableLevers.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={selectedLeverIds.size === availableLevers.length}
                        onChange={() => {
                          if (selectedLeverIds.size === availableLevers.length) {
                            setSelectedLeverIds(new Set());
                          } else {
                            setSelectedLeverIds(new Set(availableLevers.map(l => l.id)));
                          }
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Titre</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Structure</th>
                  </tr>
                </thead>
                <tbody>
                  {availableLevers.map((lever, i) => (
                    <tr key={lever.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={selectedLeverIds.has(lever.id)}
                          onChange={() => toggleLever(lever.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-gray-700 truncate max-w-xs">{lever.title}</td>
                      <td className="px-3 py-1.5 text-gray-500">{lever.improvementStructure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Duration estimate */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
            <Clock size={15} className="text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Durée estimée : <strong>~{Math.round(estimatedMinutes / 60)}h{estimatedMinutes % 60 > 0 ? `${estimatedMinutes % 60}min` : ''}</strong>
              {' '}({estimatedLevers} leviers × 3min + 45min Phase 3)
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep(1)} className="flex items-center gap-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
              <ChevronLeft size={15} /> Retour
            </button>
            <button
              onClick={handleLaunch}
              disabled={!canProceed || loading || selectedPlantIds.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-bp-primary text-white font-bold rounded-xl text-sm disabled:opacity-50 hover:bg-bp-primary/90 transition-colors"
            >
              <Users size={16} />
              {loading ? 'Démarrage...' : 'Lancer l\'atelier'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
