import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Trash2, ArrowRight } from 'lucide-react';
import type { WorkshopSession, WorkshopNewLever, ComputedSavings } from '../../../types/workshop';
import type { Plant } from '../../../types/project';
import { QuickLeverForm } from '../shared/QuickLeverForm';
import { SavingsCounter } from '../shared/SavingsCounter';

interface Phase3Props {
  session: WorkshopSession;
  plants: Plant[];
  newLevers: WorkshopNewLever[];
  computedSavings: ComputedSavings;
  projectYears: number[];
  onCreateLever: (data: Omit<WorkshopNewLever, 'id' | 'workshopId' | 'createdAt' | 'savedToLibrary' | 'savedToProject'>) => Promise<WorkshopNewLever>;
  onUpdateLever: (id: string, updates: Partial<WorkshopNewLever>) => void;
  onDeleteLever: (id: string) => void;
  onNext: () => void;
}

export function Phase3_NewLevers({
  session,
  plants,
  newLevers,
  computedSavings,
  projectYears,
  onCreateLever,
  onUpdateLever,
  onDeleteLever,
  onNext,
}: Phase3Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<string | null>(null);

  // Suggestions based on Phase 1 priorities
  const suggestions = session.clientPriorities.slice(0, 3).map(priority => {
    const plantName = plants.find(p => session.selectedPlantIds?.includes(p.id))?.name ?? 'votre usine';
    if (priority.toLowerCase().includes('pertes matière')) {
      return `Vous avez priorisé "${priority}" — avez-vous des leviers RM Losses spécifiques à ${plantName} ?`;
    }
    if (priority.toLowerCase().includes('digital')) {
      return `Vous avez priorisé "${priority}" — des automatisations identifiées sur le terrain ?`;
    }
    return `Vous avez priorisé "${priority}" — quels leviers spécifiques avez-vous observés ?`;
  });

  const handleCreate = async (data: Omit<WorkshopNewLever, 'id' | 'workshopId' | 'createdAt' | 'savedToLibrary' | 'savedToProject'>) => {
    const lever = await onCreateLever(data);
    setLastCreated(lever.id);
    setTimeout(() => setLastCreated(null), 2000);
  };

  const plantById = Object.fromEntries(plants.map(p => [p.id, p]));

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Top bar — context + suggestions */}
      <div className="border-b border-gray-200 bg-blue-50 px-6 py-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-bp-primary">
              Quels leviers avez-vous identifiés sur le terrain qui ne figurent pas encore dans notre bibliothèque ?
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Ces leviers seront créés directement dans votre projet et pourront enrichir la bibliothèque BearingPoint.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm flex-shrink-0">
            <span className="font-bold text-bp-primary">{newLevers.length} nouveaux leviers</span>
            <span className="text-gray-400">·</span>
            <span className="text-green-700 font-medium">
              +{(computedSavings.terrain.full / 1_000_000).toFixed(1)} M€ de potentiel additionnel
            </span>
          </div>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {suggestions.map((s, idx) => (
              <div key={idx} className="text-xs bg-white border border-blue-200 text-blue-700 rounded-lg px-3 py-1.5">
                💡 {s}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Savings counter */}
        <div className="p-4 flex-shrink-0 overflow-y-auto">
          <SavingsCounter
            computedSavings={computedSavings}
            showTerrain={true}
          />
        </div>

        {/* Left-center: Form */}
        <div className="w-96 flex-shrink-0 border-l border-gray-200 overflow-y-auto p-4">
          <QuickLeverForm
            plants={plants.filter(p => session.selectedPlantIds?.includes(p.id))}
            participants={session.participants}
            projectYears={projectYears}
            onSubmit={handleCreate}
          />
        </div>

        {/* Right: Created levers */}
        <div className="flex-1 overflow-y-auto p-4 border-l border-gray-200">
          {newLevers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-5xl mb-4">💡</div>
              <p className="text-sm text-center max-w-xs">
                Aucun levier créé pour l'instant. Utilisez le formulaire pour capturer les idées qui émergent.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {[...newLevers].reverse().map(lever => (
                  <motion.div
                    key={lever.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{
                      opacity: 1,
                      scale: lastCreated === lever.id ? [1, 1.02, 1] : 1,
                      y: 0
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white border border-gray-200 rounded-xl p-4"
                  >
                    {editingId === lever.id ? (
                      <EditLeverForm
                        lever={lever}
                        plants={plants}
                        participants={session.participants}
                        projectYears={projectYears}
                        onSave={(updates) => {
                          onUpdateLever(lever.id, updates);
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">🆕 Créé en atelier</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-bp-primary/10 text-bp-primary">{lever.improvementStructure}</span>
                            <span className="text-xs text-gray-500">{lever.department}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingId(lever.id)}
                              className="p-1.5 text-gray-400 hover:text-bp-secondary hover:bg-gray-100 rounded transition-colors"
                              title="Éditer"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Supprimer ce levier ?')) onDeleteLever(lever.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <h3 className="font-semibold text-gray-800 mb-2">{lever.title}</h3>

                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                          <span>~{(lever.estimatedAnnualSavings / 1000).toFixed(0)}k€/an</span>
                          <span>·</span>
                          <span>CAPEX: {(lever.estimatedCapex / 1000).toFixed(0)}k€</span>
                          <span>·</span>
                          <span className={lever.commitment === 'Commitment' ? 'text-green-600 font-medium' : 'text-blue-600'}>
                            {lever.commitment}
                          </span>
                          {lever.targetQuarter && (
                            <><span>·</span><span>{lever.targetQuarter}</span></>
                          )}
                          {lever.owner && (
                            <><span>·</span><span>Owner: {lever.owner}</span></>
                          )}
                          {plantById[lever.plantId] && (
                            <><span>·</span><span>🏭 {plantById[lever.plantId].name}</span></>
                          )}
                        </div>

                        {lever.context && (
                          <p className="text-xs text-gray-400 mt-2 italic">
                            "{lever.context}"
                          </p>
                        )}
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Bottom summary before next phase */}
      {newLevers.length > 0 && (
        <div className="border-t border-gray-200 bg-green-50 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-green-800">
            <span className="font-semibold">{newLevers.length} nouveaux leviers créés</span>
            {' · '}
            <span>+{(computedSavings.terrain.full / 1_000_000).toFixed(1)} M€ de potentiel additionnel</span>
            <span className="text-gray-500 ml-2">— Ces leviers seront inclus dans la matrice de priorisation.</span>
          </div>
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-4 py-2 bg-bp-primary text-white font-semibold rounded-lg text-sm hover:bg-bp-primary/90 transition-colors"
          >
            Passer à la priorisation <ArrowRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inline edit form ─────────────────────────────────────────────────────────

interface EditLeverFormProps {
  lever: WorkshopNewLever;
  plants: Plant[];
  participants: { name: string; role: string; isRemote: boolean }[];
  projectYears: number[];
  onSave: (updates: Partial<WorkshopNewLever>) => void;
  onCancel: () => void;
}

function EditLeverForm({ lever, plants, participants, projectYears, onSave, onCancel }: EditLeverFormProps) {
  const [form, setForm] = useState({
    title: lever.title,
    owner: lever.owner,
    targetQuarter: lever.targetQuarter,
    estimatedAnnualSavings: String(lever.estimatedAnnualSavings / 1000),
    estimatedCapex: String(lever.estimatedCapex / 1000),
    commitment: lever.commitment,
    context: lever.context,
  });

  const inputCls = "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-bp-secondary";
  const quarterOptions = projectYears.flatMap(y => [1, 2, 3, 4].map(q => `Q${q} ${y}`));

  return (
    <div className="space-y-2">
      <input
        value={form.title}
        onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
        className={`${inputCls} font-semibold`}
        placeholder="Titre..."
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={form.estimatedAnnualSavings}
          onChange={e => setForm(p => ({ ...p, estimatedAnnualSavings: e.target.value }))}
          className={inputCls}
          placeholder="Savings k€/an"
        />
        <select
          value={form.commitment}
          onChange={e => setForm(p => ({ ...p, commitment: e.target.value as 'Commitment' | 'Additional Potential' }))}
          className={inputCls + ' bg-white'}
        >
          <option value="Commitment">Commitment</option>
          <option value="Additional Potential">Additional Potential</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.owner}
          onChange={e => setForm(p => ({ ...p, owner: e.target.value }))}
          className={inputCls}
          placeholder="Owner"
          list="edit-owner-list"
        />
        <datalist id="edit-owner-list">
          {participants.map((p, i) => <option key={i} value={p.name} />)}
        </datalist>
        <select
          value={form.targetQuarter}
          onChange={e => setForm(p => ({ ...p, targetQuarter: e.target.value }))}
          className={inputCls + ' bg-white'}
        >
          <option value="">Quarter cible</option>
          {quarterOptions.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
          Annuler
        </button>
        <button
          onClick={() => onSave({
            title: form.title,
            owner: form.owner,
            targetQuarter: form.targetQuarter,
            estimatedAnnualSavings: +form.estimatedAnnualSavings * 1000,
            estimatedCapex: +form.estimatedCapex * 1000,
            commitment: form.commitment,
            context: form.context,
          })}
          className="text-xs bg-bp-primary text-white px-3 py-1.5 rounded-lg"
        >
          Mettre à jour
        </button>
      </div>
    </div>
  );
}
