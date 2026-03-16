import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PageWrapper } from '../components/layout/PageWrapper';
import { PageLoader } from '../components/ui/LoadingSkeleton';
import { useProjectStore } from '../store/projectStore';
import { useLevers } from '../hooks/useLevers';
import { useBaseline } from '../hooks/useBaseline';
import { useSavingsAggregates } from '../hooks/useSavingsAggregates';
import { formatNumber } from '../lib/calculations';

export function CapexOpexPage() {
  const { selectedProjectId, selectedYears, locale } = useProjectStore();
  const { levers, loading: leversLoading } = useLevers(selectedProjectId);
  const { baselines, loading: baselineLoading } = useBaseline(selectedProjectId);
  const agg = useSavingsAggregates(levers, baselines, selectedYears);
  const [view, setView] = useState<'annual' | 'cumulative'>('annual');

  const capexData = useMemo(() => {
    let cumTotal = 0;
    let cumApproved = 0;
    return selectedYears.map(year => {
      const yStr = String(year);
      // Distribute capex evenly across implementation years
      const yearLevers = levers.filter(l => {
        if (!l.implementationStart) return false;
        const startYear = new Date(l.implementationStart).getFullYear();
        return startYear === year;
      });

      const capexTotal = yearLevers.reduce((s, l) => s + (l.capexEUR || 0), 0);
      const capexApproved = yearLevers.reduce((s, l) => s + (l.approvedCapexEUR || 0), 0);
      const capexRequired = capexTotal - capexApproved;
      const oneOffOpex = yearLevers.reduce((s, l) => s + (l.oneOffOpexEUR || 0), 0);

      cumTotal += capexTotal;
      cumApproved += capexApproved;

      return {
        year: yStr,
        capexTotal,
        capexApproved,
        capexRequired,
        oneOffOpex,
        cumTotal,
        cumApproved,
      };
    });
  }, [levers, selectedYears]);

  const chartData = capexData.map(d => ({
    year: d.year,
    'CAPEX Total': view === 'annual' ? d.capexTotal : d.cumTotal,
    'CAPEX Approuvé': view === 'annual' ? d.capexApproved : d.cumApproved,
    'CAPEX Requis': view === 'annual' ? d.capexRequired : d.cumTotal - d.cumApproved,
  }));

  const globalCapex = {
    total: agg.commitCapex,
    approved: levers.filter(l => l.commitment === 'Commitment').reduce((s, l) => s + (l.approvedCapexEUR || 0), 0),
    oneOff: levers.filter(l => l.commitment === 'Commitment').reduce((s, l) => s + (l.oneOffOpexEUR || 0), 0),
    recurring: levers.filter(l => l.commitment === 'Commitment').reduce((s, l) => s + (l.recurringOpexEUR || 0), 0),
  };

  if (!selectedProjectId) {
    return <PageWrapper><div className="flex items-center justify-center h-48 text-gray-400">Sélectionnez un projet</div></PageWrapper>;
  }
  if (leversLoading || baselineLoading) return <PageWrapper><PageLoader /></PageWrapper>;

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'CAPEX Total (Commit.)', value: globalCapex.total, color: 'text-bp-primary' },
            { label: 'CAPEX Approuvé', value: globalCapex.approved, color: 'text-green-700' },
            { label: 'CAPEX Requis', value: globalCapex.total - globalCapex.approved, color: 'text-bp-accent' },
            { label: 'OPEX One-Off', value: globalCapex.oneOff, color: 'text-bp-secondary' },
          ].map(card => (
            <div key={card.label} className="card text-center">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`text-xl font-bold mt-1 ${card.color}`}>{formatNumber(card.value, locale)} €</p>
            </div>
          ))}
        </div>

        {/* Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setView('annual')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${view === 'annual' ? 'bg-bp-primary text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Vue Annuelle
          </button>
          <button
            onClick={() => setView('cumulative')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${view === 'cumulative' ? 'bg-bp-primary text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Vue Cumulée
          </button>
        </div>

        {/* Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Phasing CAPEX</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => formatNumber(v, locale)} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatNumber(Number(v), locale) + ' €'} />
              <Legend />
              <Bar dataKey="CAPEX Total" fill="#003057" radius={[4, 4, 0, 0]} />
              <Bar dataKey="CAPEX Approuvé" fill="#00B050" radius={[4, 4, 0, 0]} />
              <Bar dataKey="CAPEX Requis" fill="#FF6200" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detail Table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Détail CAPEX & OPEX par Année</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Année</th>
                  <th className="text-right px-4 py-3 font-semibold">CAPEX Total (€)</th>
                  <th className="text-right px-4 py-3 font-semibold">CAPEX Approuvé (€)</th>
                  <th className="text-right px-4 py-3 font-semibold">CAPEX Requis (€)</th>
                  <th className="text-right px-4 py-3 font-semibold">OPEX One-Off (€)</th>
                </tr>
              </thead>
              <tbody>
                {capexData.map((row, i) => (
                  <tr key={row.year} className={i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}>
                    <td className="px-4 py-3 font-medium text-gray-700">{row.year}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(row.capexTotal, locale)}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-700">{formatNumber(row.capexApproved, locale)}</td>
                    <td className="px-4 py-3 text-right font-mono text-bp-accent">{formatNumber(row.capexRequired, locale)}</td>
                    <td className="px-4 py-3 text-right font-mono text-bp-secondary">{formatNumber(row.oneOffOpex, locale)}</td>
                  </tr>
                ))}
                <tr className="bg-bp-primary/10 font-bold border-t-2 border-bp-primary/20">
                  <td className="px-4 py-3 text-bp-primary">TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(capexData.at(-1)?.cumTotal || 0, locale)}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">{formatNumber(capexData.at(-1)?.cumApproved || 0, locale)}</td>
                  <td className="px-4 py-3 text-right font-mono text-bp-accent">{formatNumber((capexData.at(-1)?.cumTotal || 0) - (capexData.at(-1)?.cumApproved || 0), locale)}</td>
                  <td className="px-4 py-3 text-right font-mono text-bp-secondary">{formatNumber(capexData.reduce((s, d) => s + d.oneOffOpex, 0), locale)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
