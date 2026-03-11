import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Flag, Clock, XCircle, ChevronRight, Lock } from 'lucide-react';
import type { Lever } from '../../../types/lever';
import type { LeverDecision, LeverStatus, WorkshopParticipant } from '../../../types/workshop';
import { DebateFlag } from './DebateFlag';

interface LeverCardProps {
  lever: Lever;
  decision: LeverDecision | undefined;
  isActive: boolean;
  onClick: () => void;
  onDecision: (status: LeverStatus) => void;
  participants: WorkshopParticipant[];
}

const STATUS_STYLES: Record<LeverStatus, string> = {
  pending: 'bg-white border border-gray-200',
  validated: 'bg-green-50 border-l-4 border-l-green-500 border-t border-r border-b border-gray-100',
  debated: 'bg-yellow-50 border-l-4 border-l-yellow-400 border-t border-r border-b border-gray-100',
  rejected: 'opacity-40 bg-gray-100 border border-gray-200',
  deferred: 'bg-slate-50 border border-dashed border-gray-300',
};

const STATUS_LABEL: Record<LeverStatus, string> = {
  pending: '',
  validated: 'Validé',
  debated: 'En débat',
  rejected: 'Écarté',
  deferred: 'Reporté',
};

export function LeverCard({ lever, decision, isActive, onClick, onDecision, participants }: LeverCardProps) {
  const status: LeverStatus = decision?.status ?? 'pending';
  const savings = (decision?.useClientEstimate && decision?.clientSavingsEstimate != null)
    ? decision.clientSavingsEstimate
    : lever.netSavingsEUR ?? 0;

  const handleAction = (e: React.MouseEvent, s: LeverStatus) => {
    e.stopPropagation();
    onDecision(s);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className={`rounded-xl p-4 cursor-pointer transition-shadow hover:shadow-md ${STATUS_STYLES[status]} ${isActive ? 'ring-2 ring-bp-secondary' : ''}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full bg-bp-primary/10 text-bp-primary font-medium">
            {lever.improvementStructure}
          </span>
          <span className="text-xs text-gray-500">{lever.department}</span>
          {lever.source && lever.source !== 'On-site Workshop' && (
            <span className="text-xs text-gray-400 italic">Origine: {lever.source}</span>
          )}
          {status !== 'pending' && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              status === 'validated' ? 'bg-green-100 text-green-700' :
              status === 'debated' ? 'bg-yellow-100 text-yellow-700' :
              status === 'rejected' ? 'bg-gray-200 text-gray-500' :
              'bg-slate-100 text-slate-600'
            }`}>
              {status === 'debated' && <Flag size={11} className="inline mr-1 animate-pulse" />}
              {STATUS_LABEL[status]}
            </span>
          )}
        </div>
        <ChevronRight size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
      </div>

      {/* Title */}
      <h3 className={`font-semibold text-gray-800 text-base mb-3 leading-snug ${status === 'rejected' ? 'line-through' : ''}`}>
        {lever.title}
      </h3>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/60 rounded-lg px-2 py-1.5 text-center">
          <div className="text-xs text-gray-500">Savings</div>
          <div className={`text-sm font-bold ${decision?.useClientEstimate ? 'text-orange-600' : 'text-bp-primary'}`}>
            ~{(savings / 1000).toFixed(0)}k€/an
            {decision?.useClientEstimate && <span className="text-xs ml-0.5">★</span>}
          </div>
        </div>
        <div className="bg-white/60 rounded-lg px-2 py-1.5 text-center">
          <div className="text-xs text-gray-500">CAPEX</div>
          <div className="text-sm font-bold text-gray-700">
            {((lever.capexEUR ?? 0) / 1000).toFixed(0)}k€
          </div>
        </div>
        <div className="bg-white/60 rounded-lg px-2 py-1.5 text-center">
          <div className="text-xs text-gray-500">Payback</div>
          <div className="text-sm font-bold text-gray-700">
            {lever.payback ? `${lever.payback.toFixed(1)}a` : '—'}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {status === 'pending' && (
        <div className="flex gap-1.5">
          <button
            onClick={e => handleAction(e, 'validated')}
            className="flex items-center gap-1 flex-1 justify-center text-xs px-2 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors font-medium"
          >
            <CheckCircle size={13} /> Valider
          </button>
          <button
            onClick={e => handleAction(e, 'debated')}
            className="flex items-center gap-1 flex-1 justify-center text-xs px-2 py-1.5 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg transition-colors font-medium"
          >
            <Flag size={13} /> Débat
          </button>
          <button
            onClick={e => handleAction(e, 'deferred')}
            className="flex items-center gap-1 flex-1 justify-center text-xs px-2 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            <Clock size={13} /> Reporter
          </button>
          <button
            onClick={e => handleAction(e, 'rejected')}
            className="flex items-center gap-1 flex-1 justify-center text-xs px-2 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors font-medium"
          >
            <XCircle size={13} /> Écarter
          </button>
        </div>
      )}

      {status !== 'pending' && (
        <div className="flex gap-1.5">
          <button
            onClick={e => handleAction(e, 'pending')}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
          >
            Réinitialiser
          </button>
          {status !== 'validated' && (
            <button
              onClick={e => handleAction(e, 'validated')}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-green-50 text-green-600 hover:bg-green-100 rounded transition-colors"
            >
              <CheckCircle size={11} /> Valider
            </button>
          )}
          {status !== 'debated' && status !== 'rejected' && (
            <button
              onClick={e => handleAction(e, 'debated')}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 rounded transition-colors"
            >
              <Flag size={11} /> Débat
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Active Lever Panel ───────────────────────────────────────────────────────

interface ActiveLeverPanelProps {
  lever: Lever;
  decision: LeverDecision | undefined;
  participants: WorkshopParticipant[];
  projectYears: number[];
  onUpdate: (updates: Partial<LeverDecision>) => void;
  onAddDebatePosition: (author: string, position: string) => void;
  onResolveDebate: (resolution: string) => void;
}

export function ActiveLeverPanel({
  lever, decision, participants, projectYears, onUpdate, onAddDebatePosition, onResolveDebate
}: ActiveLeverPanelProps) {
  const status = decision?.status ?? 'pending';
  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-secondary bg-white";

  const quarterOptions = projectYears.flatMap(y => [1, 2, 3, 4].map(q => `Q${q} ${y}`));

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
        <h3 className="font-semibold text-gray-800 text-sm leading-snug">{lever.title}</h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-bp-primary/10 text-bp-primary">
            {lever.improvementStructure}
          </span>
          <span className="text-xs text-gray-500">{lever.department}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Reference values */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Référence BearingPoint
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-gray-500">Savings</div>
              <div className="font-semibold text-bp-primary">{((lever.netSavingsEUR ?? 0) / 1000).toFixed(0)}k€/an</div>
            </div>
            <div>
              <div className="text-gray-500">CAPEX</div>
              <div className="font-semibold">{((lever.capexEUR ?? 0) / 1000).toFixed(0)}k€</div>
            </div>
            <div>
              <div className="text-gray-500">Payback</div>
              <div className="font-semibold">{lever.payback?.toFixed(1) ?? '—'} ans</div>
            </div>
            <div>
              <div className="text-gray-500">FTE</div>
              <div className="font-semibold">{lever.fte ?? 0}</div>
            </div>
          </div>
          {lever.benefits && (
            <div>
              <div className="text-xs text-gray-500">Bénéfices</div>
              <div className="flex gap-0.5 mt-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={`text-sm ${i < lever.benefits ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Client estimate */}
        <div>
          <div className="text-xs font-medium text-gray-700 mb-2">Estimation client</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={decision?.clientSavingsEstimate ?? ''}
              onChange={e => onUpdate({ clientSavingsEstimate: e.target.value ? +e.target.value * 1000 : null })}
              className={inputCls}
              placeholder={`~${((lever.netSavingsEUR ?? 0) / 1000).toFixed(0)}k€`}
            />
            <span className="text-xs text-gray-400 whitespace-nowrap">k€/an</span>
          </div>
          {decision?.clientSavingsEstimate != null && (
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={decision.useClientEstimate}
                onChange={e => onUpdate({ useClientEstimate: e.target.checked })}
                className="rounded"
              />
              <span className="text-xs text-gray-600">
                Utiliser cette estimation dans les calculs <span className="text-orange-500">★</span>
              </span>
            </label>
          )}
        </div>

        {/* Plan - visible if validated */}
        {status === 'validated' && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-700">Plan de transformation</div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Commitment</label>
              <select
                value={decision?.commitment ?? ''}
                onChange={e => onUpdate({ commitment: e.target.value as 'Commitment' | 'Additional Potential' | null || null })}
                className={inputCls + ' bg-white'}
              >
                <option value="">— Choisir —</option>
                <option>Commitment</option>
                <option>Additional Potential</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Owner</label>
              <input
                value={decision?.owner ?? ''}
                onChange={e => onUpdate({ owner: e.target.value })}
                className={inputCls}
                placeholder="Nom de l'owner"
                list="owner-list"
              />
              <datalist id="owner-list">
                {participants.map((p, idx) => <option key={idx} value={p.name} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Horizon</label>
              <div className="flex gap-1.5">
                {(['short', 'medium', 'long'] as const).map(h => (
                  <button
                    key={h}
                    onClick={() => onUpdate({ horizon: h })}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                      decision?.horizon === h
                        ? 'bg-bp-primary text-white border-bp-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-bp-secondary'
                    }`}
                  >
                    {h === 'short' ? '<6m' : h === 'medium' ? '6-18m' : '>18m'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Effort</label>
              <div className="flex gap-1.5">
                {(['easy', 'medium', 'complex'] as const).map(ef => (
                  <button
                    key={ef}
                    onClick={() => onUpdate({ effort: ef })}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                      decision?.effort === ef
                        ? 'bg-bp-primary text-white border-bp-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-bp-secondary'
                    }`}
                  >
                    {ef === 'easy' ? 'Facile' : ef === 'medium' ? 'Moyen' : 'Complexe'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Quarter cible</label>
              <select
                value={decision?.targetQuarter ?? ''}
                onChange={e => onUpdate({ targetQuarter: e.target.value })}
                className={inputCls + ' bg-white'}
              >
                <option value="">— Sélectionner —</option>
                {quarterOptions.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Note client</label>
            <textarea
              value={decision?.clientNote ?? ''}
              onChange={e => onUpdate({ clientNote: e.target.value })}
              className={inputCls + ' resize-none'}
              rows={2}
              placeholder="Visible dans le livrable..."
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <Lock size={11} /> Note consultant (confidentielle)
            </label>
            <textarea
              value={decision?.consultantNote ?? ''}
              onChange={e => onUpdate({ consultantNote: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bp-secondary bg-amber-50/30 resize-none"
              rows={2}
              placeholder="Note interne non affichée au client..."
            />
          </div>
        </div>

        {/* Debate section */}
        {status === 'debated' && decision && (
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-yellow-700 mb-2">
              <Flag size={12} className="animate-pulse" />
              Désaccords enregistrés
            </div>
            <DebateFlag
              decision={decision}
              participants={participants}
              onAddPosition={(author, position) => {
                onAddDebatePosition(author, position);
              }}
              onResolve={(resolution) => {
                onResolveDebate(resolution);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
