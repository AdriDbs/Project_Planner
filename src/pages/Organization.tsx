import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PageWrapper } from '../components/layout/PageWrapper';
import { PageLoader } from '../components/ui/LoadingSkeleton';
import { useProjectStore } from '../store/projectStore';
import { useLevers } from '../hooks/useLevers';
import { useBaseline } from '../hooks/useBaseline';
import { useSavingsAggregates } from '../hooks/useSavingsAggregates';
import { formatNumber, formatPercent } from '../lib/calculations';
import { DEPARTMENTS_LEVER } from '../types/lever';
import type { Department } from '../types/baseline';

export function OrganizationPage() {
  const { selectedProjectId, selectedYears, locale } = useProjectStore();
  const { levers, loading: leversLoading } = useLevers(selectedProjectId);
  const { baselines, loading: baselineLoading } = useBaseline(selectedProjectId);
  const agg = useSavingsAggregates(levers, baselines, selectedYears);
  const [fteFilter, setFteFilter] = useState<string>('');

  const tableData = useMemo(() => {
    return DEPARTMENTS_LEVER.map(dept => {
      const deptLevers = levers.filter(l => l.department === dept && l.inScope);
      const filtered = fteFilter ? deptLevers.filter(l => l.fteSavingsType === fteFilter) : deptLevers;

      const commitLevers = filtered.filter(l => l.commitment === 'Commitment');
      const addLevers = filtered.filter(l => l.commitment === 'Additional Potential');
      const fullLevers = [...commitLevers, ...addLevers];

      // Baseline FTE from baselines
      const deptKey = dept.replace(' ', '_') as Department;
      const baselineFTE = baselines.reduce((s, b) => s + (b.fteByDepartment[deptKey] || 0), 0);

      const commitFTE = commitLevers.reduce((s, l) => s + (l.fte || 0), 0);
      const fullFTE = fullLevers.reduce((s, l) => s + (l.fte || 0), 0);
      const pctCommit = baselineFTE > 0 ? commitFTE / baselineFTE : 0;
      const pctFull = baselineFTE > 0 ? fullFTE / baselineFTE : 0;

      return { dept, baselineFTE, commitFTE, fullFTE, pctCommit, pctFull };
    });
  }, [levers, baselines, fteFilter]);

  const barData = useMemo(() =>
    tableData.filter(d => d.commitFTE > 0 || d.fullFTE > 0).map(d => ({
      name: d.dept,
      commitment: d.commitFTE,
      fullPotential: d.fullFTE,
    })),
    [tableData]
  );

  if (!selectedProjectId) {
    return <PageWrapper><div className="flex items-center justify-center h-48 text-gray-400">Sélectionnez un projet</div></PageWrapper>;
  }
  if (leversLoading || baselineLoading) return <PageWrapper><PageLoader /></PageWrapper>;

  const totals = {
    baselineFTE: tableData.reduce((s, d) => s + d.baselineFTE, 0),
    commitFTE: tableData.reduce((s, d) => s + d.commitFTE, 0),
    fullFTE: tableData.reduce((s, d) => s + d.fullFTE, 0),
  };

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Filter */}
        <div className="flex gap-2">
          {['', 'Hard', 'Soft', 'Not impacting'].map(f => (
            <button
              key={f}
              onClick={() => setFteFilter(f)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                fteFilter === f ? 'bg-bp-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f || 'Tous'}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">FTE Savings par Département</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 5, right: 20, left: 20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="commitment" name="Commitment" fill="#003057" radius={[4, 4, 0, 0]} />
              <Bar dataKey="fullPotential" name="Full Potential" fill="#00A3E0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Département</th>
                  <th className="text-right px-4 py-3 font-semibold">Baseline FTE</th>
                  <th className="text-right px-4 py-3 font-semibold">Commit. FTE</th>
                  <th className="text-right px-4 py-3 font-semibold">% Commit.</th>
                  <th className="text-right px-4 py-3 font-semibold">Full Potential FTE</th>
                  <th className="text-right px-4 py-3 font-semibold">% Full Pot.</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={row.dept} className={i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}>
                    <td className="px-4 py-3 font-medium text-gray-700">{row.dept}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.baselineFTE > 0 ? row.baselineFTE.toFixed(1) : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-bp-primary">{row.commitFTE.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-semibold">
                      {row.baselineFTE > 0 ? formatPercent(row.pctCommit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-bp-secondary">{row.fullFTE.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-blue-700">
                      {row.baselineFTE > 0 ? formatPercent(row.pctFull) : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-bp-primary/10 font-bold border-t-2 border-bp-primary/20">
                  <td className="px-4 py-3 text-bp-primary">TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono">{totals.baselineFTE.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-mono text-bp-primary">{totals.commitFTE.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right text-green-700">
                    {totals.baselineFTE > 0 ? formatPercent(totals.commitFTE / totals.baselineFTE) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-bp-secondary">{totals.fullFTE.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right text-blue-700">
                    {totals.baselineFTE > 0 ? formatPercent(totals.fullFTE / totals.baselineFTE) : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
