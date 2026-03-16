import React, { useMemo } from 'react';
import { TrendingUp, DollarSign, Users, Percent, Building2 } from 'lucide-react';
import { KPICard } from '../components/ui/KPICard';
import { SavingsPhasingChart } from '../components/charts/SavingsPhasingChart';
import { PageWrapper } from '../components/layout/PageWrapper';
import { PageLoader } from '../components/ui/LoadingSkeleton';
import { useProjectStore } from '../store/projectStore';
import { useLevers } from '../hooks/useLevers';
import { useBaseline } from '../hooks/useBaseline';
import { usePlants } from '../hooks/useProjects';
import { useSavingsAggregates } from '../hooks/useSavingsAggregates';
import { formatNumber, formatPercent, computeWaterfallData } from '../lib/calculations';
import { SavingsWaterfall } from '../components/charts/SavingsWaterfall';

export function Dashboard() {
  const { selectedProjectId, selectedYears, locale } = useProjectStore();
  const { levers, loading: leversLoading } = useLevers(selectedProjectId);
  const { baselines, loading: baselineLoading } = useBaseline(selectedProjectId);
  const { plants } = usePlants(selectedProjectId);

  const agg = useSavingsAggregates(levers, baselines, selectedYears);

  const phasingData = useMemo(() =>
    selectedYears.map(year => ({
      year: String(year),
      commitment: agg.yearlySavings[year]?.commitment || 0,
      additional: agg.yearlySavings[year]?.additional || 0,
    })),
    [agg.yearlySavings, selectedYears]
  );

  const waterfallData = useMemo(() => {
    if (baselines.length === 0) return [];
    const combinedBaseline = {
      id: 'combined',
      projectId: selectedProjectId || '',
      plantId: '',
      year: selectedYears[0] - 1,
      costElements: baselines.reduce((acc, b) => {
        Object.entries(b.costElements || {}).forEach(([k, v]) => {
          (acc as any)[k] = ((acc as any)[k] || 0) + (v || 0);
        });
        return acc;
      }, {} as any),
      fteByDepartment: {} as any,
      volume: 0,
      totalFTE: 0,
    };
    return computeWaterfallData(combinedBaseline, agg.commitment);
  }, [baselines, agg.commitment, selectedProjectId, selectedYears]);

  const plantSummary = useMemo(() => {
    return plants.map(plant => {
      const plantLevers = levers.filter(l => l.plantId === plant.id && l.commitment === 'Commitment');
      const plantBaseline = baselines.find(b => b.plantId === plant.id);
      const totalSavings = plantLevers.reduce((s, l) => s + (l.netSavingsEUR || 0), 0);
      const baselineTotal = plantBaseline ? Object.values(plantBaseline.costElements || {}).reduce((s, v) => s + (v || 0), 0) : 0;
      const pct = baselineTotal > 0 ? totalSavings / baselineTotal : 0;
      const capex = plantLevers.reduce((s, l) => s + (l.capexEUR || 0), 0);
      return { plant, totalSavings, pct, capex };
    });
  }, [plants, levers, baselines]);

  if (!selectedProjectId) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Building2 size={48} className="text-gray-300" />
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-700">Aucun projet sélectionné</h2>
            <p className="text-sm text-gray-400 mt-1">Sélectionnez un projet dans l'en-tête pour commencer</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (leversLoading || baselineLoading) {
    return <PageWrapper><PageLoader /></PageWrapper>;
  }

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <KPICard
            title="Net Savings (Commitment)"
            value={`${formatNumber(agg.commitNetSavings, locale)} €`}
            subtitle={`Full Potential: ${formatNumber(agg.fullPotentialNetSavings, locale)} €`}
            icon={TrendingUp}
            color="primary"
          />
          <KPICard
            title="CAPEX Total"
            value={`${formatNumber(agg.commitCapex, locale)} €`}
            subtitle={`Full Potential: ${formatNumber(agg.fullCapex, locale)} €`}
            icon={DollarSign}
            color="secondary"
          />
          <KPICard
            title="FTE Savings"
            value={`${agg.commitFTE.toFixed(1)} FTE`}
            subtitle={`Full Potential: ${agg.fullFTE.toFixed(1)} FTE`}
            icon={Users}
            color="accent"
          />
          <KPICard
            title="% Savings vs Baseline"
            value={formatPercent(agg.percentVsBaseline)}
            subtitle={`Baseline: ${formatNumber(agg.totalBaseline, locale)} €`}
            icon={Percent}
            color="success"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-6">
          {/* Waterfall */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Waterfall Savings vs Baseline</h3>
            {waterfallData.length > 0 ? (
              <SavingsWaterfall data={waterfallData} locale={locale} />
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                Aucune donnée baseline disponible
              </div>
            )}
          </div>

          {/* Phasing */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Savings par Année</h3>
            <SavingsPhasingChart data={phasingData} locale={locale} />
          </div>
        </div>

        {/* Plant summary table */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Récapitulatif par Usine</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="text-left px-4 py-3 font-semibold rounded-tl-lg">Usine</th>
                  <th className="text-left px-4 py-3 font-semibold">Zone</th>
                  <th className="text-right px-4 py-3 font-semibold">Net Savings (€)</th>
                  <th className="text-right px-4 py-3 font-semibold">% Savings</th>
                  <th className="text-right px-4 py-3 font-semibold rounded-tr-lg">CAPEX (€)</th>
                </tr>
              </thead>
              <tbody>
                {plantSummary.map(({ plant, totalSavings, pct, capex }, i) => (
                  <tr key={plant.id} className={i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}>
                    <td className="px-4 py-3 font-medium text-bp-primary">{plant.name}</td>
                    <td className="px-4 py-3 text-gray-600">{plant.zone}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(totalSavings, locale)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${pct >= 0.05 ? 'text-green-700' : 'text-gray-600'}`}>
                        {formatPercent(pct)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(capex, locale)}</td>
                  </tr>
                ))}
                {plantSummary.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      Aucune usine configurée
                    </td>
                  </tr>
                )}
                {plantSummary.length > 0 && (
                  <tr className="bg-bp-primary/5 font-semibold border-t-2 border-bp-primary/20">
                    <td className="px-4 py-3" colSpan={2}>Total Groupe</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(agg.commitNetSavings, locale)}</td>
                    <td className="px-4 py-3 text-right">{formatPercent(agg.percentVsBaseline)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(agg.commitCapex, locale)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-bp-primary">{agg.commitment.length}</p>
            <p className="text-sm text-gray-500 mt-1">Leviers Commitment</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-bp-secondary">{agg.additional.length}</p>
            <p className="text-sm text-gray-500 mt-1">Leviers Additional Potential</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-gray-700">{levers.length}</p>
            <p className="text-sm text-gray-500 mt-1">Total Leviers</p>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
