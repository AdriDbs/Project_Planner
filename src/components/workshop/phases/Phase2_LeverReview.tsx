import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { WorkshopSession, LeverDecision, LeverStatus, ComputedSavings } from '../../../types/workshop';
import type { Lever } from '../../../types/lever';
import { LeverCard, ActiveLeverPanel } from '../shared/LeverCard';
import { SavingsCounter } from '../shared/SavingsCounter';

const LEVER_SORT_ORDER: Record<LeverStatus, number> = {
  pending: 0,
  debated: 1,
  validated: 2,
  deferred: 3,
  rejected: 4,
};

interface Phase2Props {
  session: WorkshopSession;
  levers: Lever[];
  decisions: Record<string, LeverDecision>;
  computedSavings: ComputedSavings;
  projectYears: number[];
  onMakeDecision: (leverId: string, decision: Partial<LeverDecision>) => void;
}

export function Phase2_LeverReview({
  session,
  levers,
  decisions,
  computedSavings,
  projectYears,
  onMakeDecision,
}: Phase2Props) {
  const [activeLeverId, setActiveLeverId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [structureFilter, setStructureFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

  const activeLever = levers.find(l => l.id === activeLeverId);
  const activeDecision = activeLeverId ? decisions[activeLeverId] : undefined;

  // Unique structures with counts
  const structureCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    levers.forEach(l => {
      counts[l.improvementStructure] = (counts[l.improvementStructure] ?? 0) + 1;
    });
    return counts;
  }, [levers]);

  const treatedCount = Object.values(decisions).filter(d => d.status !== 'pending').length;
  const validatedCount = Object.values(decisions).filter(d => d.status === 'validated').length;
  const debatedCount = Object.values(decisions).filter(d => d.status === 'debated').length;
  const deferredCount = Object.values(decisions).filter(d => d.status === 'deferred').length;

  // Filtered & sorted levers
  const filteredLevers = useMemo(() => {
    let result = levers;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.title?.toLowerCase().includes(q) ||
        l.improvementStructure?.toLowerCase().includes(q) ||
        l.department?.toLowerCase().includes(q)
      );
    }
    if (structureFilter) {
      result = result.filter(l => l.improvementStructure === structureFilter);
    }
    return [...result].sort((a, b) => {
      const statusA = decisions[a.id]?.status ?? 'pending';
      const statusB = decisions[b.id]?.status ?? 'pending';
      if (statusA !== statusB) return LEVER_SORT_ORDER[statusA] - LEVER_SORT_ORDER[statusB];
      // Within same status: sort by savings descending
      return (b.netSavingsEUR ?? 0) - (a.netSavingsEUR ?? 0);
    });
  }, [levers, search, structureFilter, decisions]);

  const handleDecision = (leverId: string, status: LeverStatus) => {
    const existing = decisions[leverId] ?? {};
    onMakeDecision(leverId, {
      ...existing,
      status,
      hasDebate: status === 'debated',
    });
    if (status !== 'pending' && !activeLeverId) {
      setActiveLeverId(leverId);
    }
  };

  const handleUpdateDecision = (updates: Partial<LeverDecision>) => {
    if (!activeLeverId) return;
    onMakeDecision(activeLeverId, updates);
  };

  const handleAddDebatePosition = (author: string, position: string) => {
    if (!activeLeverId) return;
    const existing = decisions[activeLeverId];
    onMakeDecision(activeLeverId, {
      debatePositions: [
        ...(existing?.debatePositions ?? []),
        { author, position, timestamp: new Date().toISOString() },
      ],
    });
  };

  const handleResolveDebate = (resolution: string) => {
    if (!activeLeverId) return;
    onMakeDecision(activeLeverId, {
      status: 'validated',
      debateResolution: resolution,
      hasDebate: false,
    });
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="h-15 border-b border-gray-200 bg-white px-4 py-3 flex items-center gap-3 flex-wrap flex-shrink-0">
        {/* Progress */}
        <div className="flex items-center gap-2 mr-2">
          <div className="text-sm font-medium text-gray-700">
            {treatedCount} / {levers.length} leviers
          </div>
          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-bp-primary rounded-full transition-all"
              style={{ width: levers.length > 0 ? `${(treatedCount / levers.length) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {/* Status badges */}
        <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
          ✓ {validatedCount} validés
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
          ⚑ {debatedCount} en débat
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
          ◷ {deferredCount} reportés
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Structure filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setStructureFilter(null)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              !structureFilter
                ? 'bg-bp-primary text-white border-bp-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:border-bp-secondary'
            }`}
          >
            Tous ({levers.length})
          </button>
          {Object.entries(structureCounts).map(([s, count]) => (
            <button
              key={s}
              onClick={() => setStructureFilter(s === structureFilter ? null : s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                structureFilter === s
                  ? 'bg-bp-primary text-white border-bp-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-bp-secondary'
              }`}
            >
              {s} ({count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-bp-secondary w-44"
            placeholder="Rechercher..."
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Savings Counter */}
        <div className="p-4 flex-shrink-0 overflow-y-auto">
          <SavingsCounter
            computedSavings={computedSavings}
            participants={session.participants}
          />
        </div>

        {/* Center: Lever List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredLevers.length === 0 && (
            <div className="text-center text-gray-400 py-12">
              Aucun levier correspondant aux filtres
            </div>
          )}
          {filteredLevers.map(lever => (
            <LeverCard
              key={lever.id}
              lever={lever}
              decision={decisions[lever.id]}
              isActive={activeLeverId === lever.id}
              onClick={() => setActiveLeverId(lever.id === activeLeverId ? null : lever.id)}
              onDecision={(status) => handleDecision(lever.id, status)}
              participants={session.participants}
            />
          ))}
        </div>

        {/* Right: Active lever panel */}
        {activeLever ? (
          <ActiveLeverPanel
            lever={activeLever}
            decision={activeDecision}
            participants={session.participants}
            projectYears={projectYears}
            onUpdate={handleUpdateDecision}
            onAddDebatePosition={handleAddDebatePosition}
            onResolveDebate={handleResolveDebate}
          />
        ) : (
          <div className="w-80 flex-shrink-0 bg-gray-50 border-l border-gray-200 flex items-center justify-center">
            <p className="text-gray-400 text-sm text-center px-6">
              Cliquez sur un levier pour voir sa fiche détaillée
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
