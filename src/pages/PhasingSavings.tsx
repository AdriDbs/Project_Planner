import React, { useState, useMemo } from 'react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { PageLoader } from '../components/ui/LoadingSkeleton';
import { SavingsPhasingChart } from '../components/charts/SavingsPhasingChart';
import { useProjectStore } from '../store/projectStore';
import { useLevers } from '../hooks/useLevers';
import { useBaseline } from '../hooks/useBaseline';
import { useSavingsAggregates } from '../hooks/useSavingsAggregates';
import { formatNumber, formatPercent, totalBaselineCost } from '../lib/calculations';
import { IMPROVEMENT_STRUCTURES } from '../types/lever';

export function PhasingSavingsPage() {
  const { selectedProjectId, selectedYears, locale } = useProjectStore();
  const { levers, loading: leversLoading } = useLevers(selectedProjectId);
  const { baselines, loading: baselineLoading } = useBaseline(selectedProjectId);
  const agg = useSavingsAggregates(levers, baselines, selectedYears);
  const [viewMode, setViewMode] = useState<'structure' | 'department'>('structure');
  const [showCumulative, setShowCumulative] = useState(false);

  const phasingData = useMemo(() => {
    let cumulative = 0;
    return selectedYears.map(year => {
      const yStr = String(year);
      const commitment = agg.yearlySavings[yStr]?.commitment || 0;
      const additional = agg.yearlySavings[yStr]?.additional || 0;
      cumulative += commitment + additional;
      return { year: yStr, commitment, additional, cumulative };
    });
  }, [agg.yearlySavings, selectedYears]);

  const tableData = useMemo(() => {
    const groups = viewMode === 'structure' ? IMPROVEMENT_STRUCTURES : [
      'Manufacturing', 'Supply Chain', 'Maintenance', 'Purchasing', 'Quality'
    ];

    return groups.map(group => {
      const filteredLevers = levers.filter(l =>
        viewMode === 'structure' ? l.improvementStructure === group : l.department === group
      );
      const yearValues = selectedYears.map(year => {
        const yStr = String(year);
        return filteredLevers.reduce((s, l) => s + (l.savingsByYear?.[yStr] || 0), 0);
      });
      const total = yearValues.reduce((s, v) => s + v, 0);
      const baselineTotal = agg.totalBaseline;
      const pct = baselineTotal > 0 ? total / baselineTotal : 0;
      return { group, yearValues, total, pct };
    }).filter(d => d.total > 0);
  }, [levers, selectedYears, viewMode, agg.totalBaseline]);

  if (!selectedProjectId) {
    return <PageWrapper><div className="flex items-center justify-center h-48 text-gray-400">Sélectionnez un projet</div></PageWrapper>;
  }
  if (leversLoading || baselineLoading) return <PageWrapper><PageLoader /></PageWrapper>;

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Toggles */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('structure')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${viewMode === 'structure' ? 'bg-bp-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Par Nature de Coût
            </button>
            <button
              onClick={() => setViewMode('department')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${viewMode === 'department' ? 'bg-bp-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Par Département
            </button>
          </div>
          <button
            onClick={() => setShowCumulative(!showCumulative)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${showCumulative ? 'bg-bp-secondary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {showCumulative ? 'Vue Cumulée' : 'Vue Annuelle'}
          </button>
        </div>

        {/* Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            {showCumulative ? 'Courbe d\'Accumulation des Savings' : 'Savings par Année (Commitment + Additional Potential)'}
          </h3>
          <SavingsPhasingChart data={phasingData} locale={locale} showCumulative={showCumulative} />
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Phasing Détaillé</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">{viewMode === 'structure' ? 'Nature de Coût' : 'Département'}</th>
                  <th className="text-right px-4 py-3 font-semibold">Baseline</th>
                  {selectedYears.map(y => (
                    <th key={y} className="text-right px-4 py-3 font-semibold">{y}</th>
                  ))}
                  <th className="text-right px-4 py-3 font-semibold">Total</th>
                  <th className="text-right px-4 py-3 font-semibold">% Baseline</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={row.group} className={i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}>
                    <td className="px-4 py-3 font-medium text-gray-700">{row.group}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-400">—</td>
                    {row.yearValues.map((v, j) => (
                      <td key={j} className="px-4 py-3 text-right font-mono">{formatNumber(v, locale)}</td>
                    ))}
                    <td className="px-4 py-3 text-right font-mono font-semibold">{formatNumber(row.total, locale)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${row.pct >= 0.05 ? 'text-green-700' : 'text-gray-500'}`}>
                        {formatPercent(row.pct)}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-bp-primary/10 font-bold border-t-2 border-bp-primary/20">
                  <td className="px-4 py-3 text-bp-primary">TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500">{formatNumber(agg.totalBaseline, locale)}</td>
                  {selectedYears.map(year => {
                    const yStr = String(year);
                    const val = (agg.yearlySavings[yStr]?.commitment || 0) + (agg.yearlySavings[yStr]?.additional || 0);
                    return <td key={year} className="px-4 py-3 text-right font-mono">{formatNumber(val, locale)}</td>;
                  })}
                  <td className="px-4 py-3 text-right font-mono text-bp-primary">{formatNumber(agg.fullPotentialNetSavings, locale)}</td>
                  <td className="px-4 py-3 text-right text-bp-primary">{formatPercent(agg.percentVsBaseline)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
