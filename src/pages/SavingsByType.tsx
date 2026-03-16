import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { PageWrapper } from '../components/layout/PageWrapper';
import { PageLoader } from '../components/ui/LoadingSkeleton';
import { SavingsDonut } from '../components/charts/SavingsDonut';
import { useProjectStore } from '../store/projectStore';
import { useLevers } from '../hooks/useLevers';
import { useBaseline } from '../hooks/useBaseline';
import { useSavingsAggregates } from '../hooks/useSavingsAggregates';
import { formatNumber } from '../lib/calculations';
import { IMPROVEMENT_STRUCTURES } from '../types/lever';

export function SavingsByTypePage() {
  const { selectedProjectId, selectedYears, locale } = useProjectStore();
  const { levers, loading: leversLoading } = useLevers(selectedProjectId);
  const { baselines, loading: baselineLoading } = useBaseline(selectedProjectId);
  const agg = useSavingsAggregates(levers, baselines, selectedYears);

  const tableData = useMemo(() => {
    return IMPROVEMENT_STRUCTURES.map(structure => {
      const commitLevers = agg.commitment.filter(l => l.improvementStructure === structure);
      const addLevers = agg.additional.filter(l => l.improvementStructure === structure);
      const fullLevers = [...commitLevers, ...addLevers];

      const commitNetSavings = commitLevers.reduce((s, l) => s + (l.netSavingsEUR || 0), 0);
      const additionalNetSavings = addLevers.reduce((s, l) => s + (l.netSavingsEUR || 0), 0);
      const fullNetSavings = fullLevers.reduce((s, l) => s + (l.netSavingsEUR || 0), 0);
      const commitCapex = commitLevers.reduce((s, l) => s + (l.capexEUR || 0), 0);
      const fullCapex = fullLevers.reduce((s, l) => s + (l.capexEUR || 0), 0);

      return { structure, commitNetSavings, additionalNetSavings, fullNetSavings, commitCapex, fullCapex };
    }).filter(d => d.fullNetSavings !== 0 || d.fullCapex !== 0);
  }, [agg]);

  const donutData = useMemo(() =>
    tableData
      .filter(d => d.commitNetSavings > 0)
      .map(d => ({ name: d.structure, value: d.commitNetSavings })),
    [tableData]
  );

  const barData = useMemo(() =>
    tableData.map(d => ({
      name: d.structure,
      commitment: d.commitNetSavings,
      fullPotential: d.fullNetSavings,
    })),
    [tableData]
  );

  const totals = useMemo(() => ({
    commitNetSavings: tableData.reduce((s, d) => s + d.commitNetSavings, 0),
    additionalNetSavings: tableData.reduce((s, d) => s + d.additionalNetSavings, 0),
    fullNetSavings: tableData.reduce((s, d) => s + d.fullNetSavings, 0),
    commitCapex: tableData.reduce((s, d) => s + d.commitCapex, 0),
    fullCapex: tableData.reduce((s, d) => s + d.fullCapex, 0),
  }), [tableData]);

  if (!selectedProjectId) {
    return <PageWrapper><div className="flex items-center justify-center h-48 text-gray-400">Sélectionnez un projet</div></PageWrapper>;
  }
  if (leversLoading || baselineLoading) return <PageWrapper><PageLoader /></PageWrapper>;

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Savings par Nature de Coût</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Structure</th>
                  <th className="text-right px-4 py-3 font-semibold">Net Savings Commit. (€)</th>
                  <th className="text-right px-4 py-3 font-semibold">Net Savings Add. Pot. (€)</th>
                  <th className="text-right px-4 py-3 font-semibold">Full Potential (€)</th>
                  <th className="text-right px-4 py-3 font-semibold">CAPEX Commit. (€)</th>
                  <th className="text-right px-4 py-3 font-semibold">CAPEX Full Pot. (€)</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={row.structure} className={i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}>
                    <td className="px-4 py-3 font-medium text-gray-700">{row.structure}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-700">{formatNumber(row.commitNetSavings, locale)}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-700">{formatNumber(row.additionalNetSavings, locale)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{formatNumber(row.fullNetSavings, locale)}</td>
                    <td className="px-4 py-3 text-right font-mono text-bp-accent">{formatNumber(row.commitCapex, locale)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(row.fullCapex, locale)}</td>
                  </tr>
                ))}
                <tr className="bg-bp-primary/10 font-bold border-t-2 border-bp-primary/20">
                  <td className="px-4 py-3 text-bp-primary">TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">{formatNumber(totals.commitNetSavings, locale)}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700">{formatNumber(totals.additionalNetSavings, locale)}</td>
                  <td className="px-4 py-3 text-right font-mono text-bp-primary">{formatNumber(totals.fullNetSavings, locale)}</td>
                  <td className="px-4 py-3 text-right font-mono text-bp-accent">{formatNumber(totals.commitCapex, locale)}</td>
                  <td className="px-4 py-3 text-right font-mono text-bp-primary">{formatNumber(totals.fullCapex, locale)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Répartition par Nature de Coût (Commitment)</h3>
            {donutData.length > 0 ? (
              <SavingsDonut data={donutData} locale={locale} />
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>
            )}
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Commitment vs Full Potential</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top: 5, right: 20, left: 40, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                <YAxis tickFormatter={(v) => formatNumber(v, locale)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatNumber(Number(v), locale) + ' €'} />
                <Legend />
                <Bar dataKey="commitment" name="Commitment" fill="#003057" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fullPotential" name="Full Potential" fill="#00A3E0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
