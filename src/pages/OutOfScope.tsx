import React from 'react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { useProjectStore } from '../store/projectStore';
import { useLevers } from '../hooks/useLevers';
import { useSavingsAggregates } from '../hooks/useSavingsAggregates';
import { formatNumber } from '../lib/calculations';
import { CommitmentBadge } from '../components/ui/Badge';

export function OutOfScopePage() {
  const { selectedProjectId, selectedYears, locale } = useProjectStore();
  const { levers, loading } = useLevers(selectedProjectId);

  const outOfScopeLevers = levers.filter(l => !l.inScope);
  const noGoLevers = levers.filter(l => l.commitment === 'No Go');

  if (!selectedProjectId) {
    return <PageWrapper><div className="flex items-center justify-center h-48 text-gray-400">Sélectionnez un projet</div></PageWrapper>;
  }

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Out of Scope */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Leviers Hors Périmètre (Out of Scope)</h3>
            <p className="text-xs text-gray-500 mt-1">{outOfScopeLevers.length} levier(s)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">ID</th>
                  <th className="text-left px-4 py-3 font-semibold">Levier</th>
                  <th className="text-left px-4 py-3 font-semibold">Structure</th>
                  <th className="text-left px-4 py-3 font-semibold">Commitment</th>
                  <th className="text-right px-4 py-3 font-semibold">FY Total Savings (€)</th>
                  <th className="text-right px-4 py-3 font-semibold">CAPEX (€)</th>
                </tr>
              </thead>
              <tbody>
                {outOfScopeLevers.map((lever, i) => (
                  <tr key={lever.id} className={i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}>
                    <td className="px-4 py-2.5 font-mono text-xs text-bp-primary font-semibold">{lever.leverId}</td>
                    <td className="px-4 py-2.5 text-gray-700 text-xs max-w-xs truncate">{lever.title}</td>
                    <td className="px-4 py-2.5">{lever.improvementStructure}</td>
                    <td className="px-4 py-2.5"><CommitmentBadge value={lever.commitment} /></td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatNumber(lever.fyTotalSavingsEUR, locale)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatNumber(lever.capexEUR, locale)}</td>
                  </tr>
                ))}
                {outOfScopeLevers.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Aucun levier hors périmètre</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* No Go */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Leviers No Go</h3>
            <p className="text-xs text-gray-500 mt-1">{noGoLevers.length} levier(s)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">ID</th>
                  <th className="text-left px-4 py-3 font-semibold">Levier</th>
                  <th className="text-left px-4 py-3 font-semibold">Département</th>
                  <th className="text-right px-4 py-3 font-semibold">FY Total Savings (€)</th>
                  <th className="text-left px-4 py-3 font-semibold">Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {noGoLevers.map((lever, i) => (
                  <tr key={lever.id} className={i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}>
                    <td className="px-4 py-2.5 font-mono text-xs text-bp-primary font-semibold">{lever.leverId}</td>
                    <td className="px-4 py-2.5 text-gray-700 text-xs max-w-xs truncate">{lever.title}</td>
                    <td className="px-4 py-2.5 text-gray-600">{lever.department}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatNumber(lever.fyTotalSavingsEUR, locale)}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs truncate max-w-xs">{lever.comment || '—'}</td>
                  </tr>
                ))}
                {noGoLevers.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Aucun levier No Go</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
