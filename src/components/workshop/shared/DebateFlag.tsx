import React, { useState } from 'react';
import { Flag, Plus, CheckCircle } from 'lucide-react';
import type { LeverDecision } from '../../../types/workshop';

interface DebateFlagProps {
  decision: LeverDecision;
  participants: { name: string }[];
  onAddPosition: (author: string, position: string) => void;
  onResolve: (resolution: string) => void;
}

export function DebateFlag({ decision, participants, onAddPosition, onResolve }: DebateFlagProps) {
  const [showForm, setShowForm] = useState(false);
  const [author, setAuthor] = useState('');
  const [position, setPosition] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolution, setResolution] = useState('');

  const handleAddPosition = () => {
    if (!author.trim() || !position.trim()) return;
    onAddPosition(author.trim(), position.trim());
    setAuthor('');
    setPosition('');
    setShowForm(false);
  };

  const handleResolve = () => {
    if (!resolution.trim()) return;
    onResolve(resolution.trim());
    setShowResolveForm(false);
    setResolution('');
  };

  return (
    <div className="space-y-3">
      {/* Existing positions */}
      {decision.debatePositions.length > 0 && (
        <div className="space-y-2">
          {decision.debatePositions.map((pos, idx) => (
            <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-yellow-800">{pos.author}</span>
                <span className="text-xs text-gray-400">
                  {new Date(pos.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-gray-700">{pos.position}</p>
            </div>
          ))}
        </div>
      )}

      {/* Resolution */}
      {decision.debateResolution && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle size={14} className="text-green-600" />
            <span className="text-xs font-medium text-green-700">Résolu</span>
          </div>
          <p className="text-sm text-gray-700">{decision.debateResolution}</p>
        </div>
      )}

      {/* Add position form */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Auteur</label>
            <input
              value={author}
              onChange={e => setAuthor(e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-bp-secondary"
              placeholder="Nom du participant"
              list="participants-list"
            />
            <datalist id="participants-list">
              {participants.map((p, idx) => <option key={idx} value={p.name} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Position</label>
            <textarea
              value={position}
              onChange={e => setPosition(e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-bp-secondary resize-none"
              rows={2}
              placeholder="Décrire la position ou l'objection..."
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
              Annuler
            </button>
            <button
              onClick={handleAddPosition}
              disabled={!author.trim() || !position.trim()}
              className="text-xs bg-yellow-500 text-white px-3 py-1 rounded disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Resolve form */}
      {showResolveForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
          <label className="block text-xs text-gray-600 mb-1">Note de résolution</label>
          <textarea
            value={resolution}
            onChange={e => setResolution(e.target.value)}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-bp-secondary resize-none"
            rows={2}
            placeholder="Comment le débat a-t-il été résolu ?"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowResolveForm(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
              Annuler
            </button>
            <button
              onClick={handleResolve}
              disabled={!resolution.trim()}
              className="text-xs bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50"
            >
              Marquer comme résolu
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!decision.debateResolution && (
        <div className="flex gap-2">
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-800 px-2 py-1 hover:bg-yellow-50 rounded transition-colors"
            >
              <Plus size={13} /> Ajouter une position
            </button>
          )}
          {decision.debatePositions.length > 0 && !showResolveForm && (
            <button
              onClick={() => setShowResolveForm(true)}
              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 px-2 py-1 hover:bg-green-50 rounded transition-colors"
            >
              <CheckCircle size={13} /> Marquer comme résolu
            </button>
          )}
        </div>
      )}
    </div>
  );
}
