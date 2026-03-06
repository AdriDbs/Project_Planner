import { useMemo } from 'react';
import type { Lever } from '../types/lever';
import type { Baseline } from '../types/baseline';
import {
  totalNetSavings, totalCapex, totalFTE,
  savingsByImprovementStructure, computeYearlySavingsPhasing,
  totalBaselineCost, savingsPercentVsBaseline
} from '../lib/calculations';

export function useSavingsAggregates(levers: Lever[], baselines: Baseline[], years: number[]) {
  return useMemo(() => {
    const commitment = levers.filter(l => l.commitment === 'Commitment');
    const additional = levers.filter(l => l.commitment === 'Additional Potential');
    const inScope = levers.filter(l => l.inScope);

    const totalBaseline = baselines.reduce((s, b) => s + totalBaselineCost(b), 0);

    const commitNetSavings = totalNetSavings(commitment);
    const fullPotentialNetSavings = totalNetSavings([...commitment, ...additional]);
    const commitCapex = totalCapex(commitment);
    const fullCapex = totalCapex([...commitment, ...additional]);
    const commitFTE = totalFTE(commitment);
    const fullFTE = totalFTE([...commitment, ...additional]);

    const percentVsBaseline = savingsPercentVsBaseline(commitNetSavings, totalBaseline);

    const yearlySavings = computeYearlySavingsPhasing([...commitment, ...additional], years);

    const byStructureCommit = savingsByImprovementStructure(commitment);
    const byStructureFull = savingsByImprovementStructure([...commitment, ...additional]);

    return {
      commitment,
      additional,
      inScope,
      totalBaseline,
      commitNetSavings,
      fullPotentialNetSavings,
      commitCapex,
      fullCapex,
      commitFTE,
      fullFTE,
      percentVsBaseline,
      yearlySavings,
      byStructureCommit,
      byStructureFull,
    };
  }, [levers, baselines, years]);
}
