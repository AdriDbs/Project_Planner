import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { AlertTriangle } from 'lucide-react';
import type { WorkshopSession, LeverDecision, WorkshopNewLever } from '../../../types/workshop';
import type { Lever } from '../../../types/lever';

interface RoadmapItem {
  id: string;
  title: string;
  type: 'library' | 'terrain';
  owner: string;
  targetQuarter: string;
  commitment: string | null;
  savings: number;
  capex: number;
  status: string;
}

interface Phase5Props {
  session: WorkshopSession;
  levers: Lever[];
  decisions: Record<string, LeverDecision>;
  newLevers: WorkshopNewLever[];
  projectYears: number[];
  onUpdateDecision: (leverId: string, updates: Partial<LeverDecision>) => void;
  onUpdateNewLever: (leverId: string, updates: Partial<WorkshopNewLever>) => void;
  onUpdateSession: (updates: Partial<WorkshopSession>) => void;
}

const STRUCTURE_COLORS: Record<string, string> = {
  DLC: '#003057', PILC: '#00A3E0', OVC: '#FF6200',
  'FC-Personal': '#00B050', Maintenance: '#FFC000',
  OFC: '#7C3AED', 'RM Losses': '#DC2626', 'PM Losses': '#EA580C',
};

export function Phase5_Roadmap({
  session, levers, decisions, newLevers, projectYears, onUpdateDecision, onUpdateNewLever, onUpdateSession
}: Phase5Props) {
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [scopeText, setScopeText] = useState(session.agreedScope ?? '');
  const [noOwnerFilter, setNoOwnerFilter] = useState(false);

  const quarterOptions = projectYears.flatMap(y => [1, 2, 3, 4].map(q => `Q${q} ${y}`));
  const allQuarters = quarterOptions;

  // Build roadmap items
  const roadmapItems = useMemo((): RoadmapItem[] => {
    const items: RoadmapItem[] = [];

    levers.filter(l => decisions[l.id]?.status === 'validated').forEach(l => {
      const d = decisions[l.id];
      const savings = (d?.useClientEstimate && d?.clientSavingsEstimate != null)
        ? d.clientSavingsEstimate
        : (l.netSavingsEUR ?? 0);
      items.push({
        id: l.id,
        title: l.title,
        type: 'library',
        owner: d?.owner ?? '',
        targetQuarter: d?.targetQuarter ?? '',
        commitment: d?.commitment ?? null,
        savings,
        capex: l.capexEUR ?? 0,
        status: d?.status ?? 'validated',
      });
    });

    newLevers.forEach(l => {
      items.push({
        id: l.id,
        title: l.title,
        type: 'terrain',
        owner: l.owner ?? '',
        targetQuarter: l.targetQuarter ?? '',
        commitment: l.commitment,
        savings: l.estimatedAnnualSavings ?? 0,
        capex: l.estimatedCapex ?? 0,
        status: 'validated',
      });
    });

    return items;
  }, [levers, decisions, newLevers]);

  const filteredItems = noOwnerFilter
    ? roadmapItems.filter(i => !i.owner.trim())
    : roadmapItems;

  const noOwnerCount = roadmapItems.filter(i => !i.owner.trim()).length;

  // Group by quarter
  const byQuarter = useMemo(() => {
    const map: Record<string, RoadmapItem[]> = {};
    allQuarters.forEach(q => { map[q] = []; });
    roadmapItems.forEach(item => {
      if (item.targetQuarter && map[item.targetQuarter]) {
        map[item.targetQuarter].push(item);
      } else {
        map[''] = map[''] ?? [];
        map[''].push(item);
      }
    });
    return map;
  }, [roadmapItems, allQuarters]);

  // Cumulative savings for chart
  const cumulativeSavings = useMemo(() => {
    let cumul = 0;
    return allQuarters.map(q => {
      const quarterSavings = (byQuarter[q] ?? []).reduce((s, i) => s + i.savings, 0);
      cumul += quarterSavings / 4; // Annualized → quarterly
      return { quarter: q, savings: Math.round(cumul / 1000) }; // k€
    });
  }, [byQuarter, allQuarters]);

  const autoScope = () => {
    const commitment = roadmapItems.filter(i => i.commitment === 'Commitment');
    const total = roadmapItems;
    const totalSavings = total.reduce((s, i) => s + i.savings, 0);
    const commitmentSavings = commitment.reduce((s, i) => s + i.savings, 0);
    const addPotential = totalSavings - commitmentSavings;
    const totalCapex = total.reduce((s, i) => s + i.capex, 0);
    const debated = Object.values(decisions).filter(d => d.status === 'debated').length;

    return `Scope convenu : ${total.length} leviers (${levers.filter(l => decisions[l.id]?.status === 'validated').length} bibliothèque + ${newLevers.length} terrain)
Net Savings Commitment : ${(commitmentSavings / 1_000_000).toFixed(1)} M€ | Full Potential : ${(totalSavings / 1_000_000).toFixed(1)} M€
CAPEX requis : ${(totalCapex / 1_000_000).toFixed(1)} M€
Leviers en débat à escalader : ${debated}`;
  };

  const handleOpenScopeModal = () => {
    if (!scopeText) setScopeText(autoScope());
    setShowScopeModal(true);
  };

  const handleConfirmScope = () => {
    onUpdateSession({ agreedScope: scopeText });
    setShowScopeModal(false);
  };

  const updateOwner = (item: RoadmapItem, owner: string) => {
    if (item.type === 'library') onUpdateDecision(item.id, { owner });
    else onUpdateNewLever(item.id, { owner });
  };

  const updateQuarter = (item: RoadmapItem, quarter: string) => {
    if (item.type === 'library') onUpdateDecision(item.id, { targetQuarter: quarter });
    else onUpdateNewLever(item.id, { targetQuarter: quarter });
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Timeline (40%) */}
      <div className="flex-[40] border-b border-gray-200 overflow-x-auto">
        <div className="h-full flex flex-col p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700 text-sm">Timeline</h3>
            <div className="flex items-center gap-2">
              {noOwnerCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  <AlertTriangle size={12} /> {noOwnerCount} sans owner
                </span>
              )}
              <button
                onClick={handleOpenScopeModal}
                className="text-xs px-3 py-1.5 bg-bp-primary text-white rounded-lg hover:bg-bp-primary/90 transition-colors"
              >
                Valider le scope BearingPoint
              </button>
            </div>
          </div>

          {/* Quarter columns */}
          <div className="flex gap-3 overflow-x-auto flex-1 pb-2">
            {allQuarters.slice(0, 8).map(q => {
              const items = byQuarter[q] ?? [];
              const quarterSavings = items.reduce((s, i) => s + i.savings, 0);
              return (
                <div key={q} className="min-w-36 flex-shrink-0">
                  <div className="text-xs font-medium text-gray-500 mb-2 text-center">{q}</div>
                  <div className="space-y-1 mb-2">
                    {items.map(item => (
                      <div
                        key={item.id}
                        className={`text-xs px-2 py-1 rounded-lg truncate ${
                          item.type === 'terrain'
                            ? 'bg-blue-100 text-blue-800 border border-dashed border-blue-300'
                            : 'text-white'
                        }`}
                        style={item.type === 'library' ? {
                          background: '#003057',
                          opacity: 0.85,
                        } : undefined}
                        title={item.title}
                      >
                        {item.type === 'terrain' && '🆕 '}{item.title}
                      </div>
                    ))}
                  </div>
                  {quarterSavings > 0 && (
                    <div className="text-xs text-gray-400 text-center">
                      {(quarterSavings / 1_000_000).toFixed(1)} M€
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Area chart */}
          <div className="h-20 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeSavings.slice(0, 8)} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="quarter" hide />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => [`${v}k€`, 'Savings cumulés']}
                  contentStyle={{ fontSize: 11, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="savings"
                  fill="#003057"
                  stroke="#003057"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table (60%) */}
      <div className="flex-[60] overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-semibold text-gray-700 text-sm">Plan d'actions</h3>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={noOwnerFilter}
              onChange={e => setNoOwnerFilter(e.target.checked)}
              className="rounded"
            />
            Afficher sans owner uniquement
          </label>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Levier</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Owner</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Quarter</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Commitment</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs">Savings k€</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs">CAPEX k€</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, i) => (
                <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-2 max-w-xs">
                    <span className={`text-sm ${!item.owner ? 'text-amber-600' : 'text-gray-800'}`}>
                      {item.title}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {item.type === 'terrain' ? (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">🆕 Terrain</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">📚 Biblio.</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={item.owner}
                      onChange={e => updateOwner(item, e.target.value)}
                      className={`w-32 border rounded px-2 py-1 text-xs focus:outline-none focus:border-bp-secondary ${
                        !item.owner ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
                      }`}
                      placeholder="Owner"
                      list="roadmap-owners"
                    />
                    <datalist id="roadmap-owners">
                      {session.participants.map((p, idx) => <option key={idx} value={p.name} />)}
                    </datalist>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={item.targetQuarter}
                      onChange={e => updateQuarter(item, e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-bp-secondary bg-white"
                    >
                      <option value="">— Quarter —</option>
                      {quarterOptions.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    {item.commitment ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.commitment === 'Commitment' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {item.commitment}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-bp-primary text-xs">
                    {(item.savings / 1000).toFixed(0)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600 text-xs">
                    {(item.capex / 1000).toFixed(0)}
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                    {noOwnerFilter ? 'Tous les leviers ont un owner ! ✓' : 'Aucun levier dans le plan'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scope modal */}
      {showScopeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="font-bold text-gray-800 mb-3">Valider le scope BearingPoint</h3>
            <textarea
              value={scopeText}
              onChange={e => setScopeText(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-bp-secondary resize-none font-mono"
              rows={6}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowScopeModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleConfirmScope} className="flex-1 py-2.5 bg-bp-primary text-white font-semibold rounded-xl text-sm hover:bg-bp-primary/90">
                Confirmer le scope
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
