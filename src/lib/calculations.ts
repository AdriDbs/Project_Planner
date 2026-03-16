import type { Lever } from '../types/lever';
import type { Baseline, CostElement } from '../types/baseline';

export function formatNumber(value: number, locale: 'fr' | 'en' = 'fr'): string {
  if (isNaN(value)) return '0';
  if (locale === 'fr') {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function formatCurrency(value: number, currency = 'EUR', locale: 'fr' | 'en' = 'fr'): string {
  if (isNaN(value)) return '0';
  const formatted = formatNumber(value, locale);
  return `${formatted} ${currency}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function aggregateByCommitment(levers: Lever[], commitment: 'Commitment' | 'Additional Potential' | 'No Go') {
  return levers.filter(l => l.commitment === commitment);
}

export function totalSavings(levers: Lever[], currency: 'LC' | 'EUR' = 'EUR'): number {
  return levers.reduce((sum, l) => sum + (currency === 'EUR' ? (l.fyTotalSavingsEUR || 0) : (l.fyTotalSavingsLC || 0)), 0);
}

export function totalNetSavings(levers: Lever[], currency: 'LC' | 'EUR' = 'EUR'): number {
  return levers.reduce((sum, l) => sum + (currency === 'EUR' ? (l.netSavingsEUR || 0) : (l.netSavingsLC || 0)), 0);
}

export function totalCapex(levers: Lever[], currency: 'LC' | 'EUR' = 'EUR'): number {
  return levers.reduce((sum, l) => sum + (currency === 'EUR' ? (l.capexEUR || 0) : (l.capexLC || 0)), 0);
}

export function totalFTE(levers: Lever[]): number {
  return levers.reduce((sum, l) => sum + (l.fte || 0), 0);
}

export function savingsByYear(levers: Lever[], year: string): number {
  return levers.reduce((sum, l) => sum + (l.savingsByYear?.[year] || 0), 0);
}

export function savingsByImprovementStructure(levers: Lever[]): Record<string, number> {
  return levers.reduce((acc, l) => {
    const key = l.improvementStructure;
    acc[key] = (acc[key] || 0) + (l.netSavingsEUR || 0);
    return acc;
  }, {} as Record<string, number>);
}

export function savingsByDepartment(levers: Lever[]): Record<string, number> {
  return levers.reduce((acc, l) => {
    const key = l.department;
    acc[key] = (acc[key] || 0) + (l.netSavingsEUR || 0);
    return acc;
  }, {} as Record<string, number>);
}

export function totalBaselineCost(baseline: Baseline): number {
  if (!baseline.costElements) return 0;
  return Object.values(baseline.costElements).reduce((sum, v) => sum + (v || 0), 0);
}

export function savingsPercentVsBaseline(savings: number, baselineCost: number): number {
  if (baselineCost === 0) return 0;
  return savings / baselineCost;
}

export function computeYearlySavingsPhasing(levers: Lever[], years: number[]): Record<string, { commitment: number; additional: number }> {
  const result: Record<string, { commitment: number; additional: number }> = {};
  years.forEach(year => {
    const yStr = String(year);
    result[yStr] = { commitment: 0, additional: 0 };
    levers.forEach(l => {
      const val = l.savingsByYear?.[yStr] || 0;
      if (l.commitment === 'Commitment') result[yStr].commitment += val;
      else if (l.commitment === 'Additional Potential') result[yStr].additional += val;
    });
  });
  return result;
}

export function computeWaterfallData(baseline: Baseline, levers: Lever[]): { name: string; value: number; type: 'baseline' | 'saving' | 'total' }[] {
  const costElements: CostElement[] = ['DLC', 'PILC', 'OVC', 'FC_Personal', 'Maintenance', 'OFC', 'RM_Losses', 'PM_Losses'];
  const savingsByStructure = savingsByImprovementStructure(levers.filter(l => l.commitment === 'Commitment'));
  
  const totalBaseline = totalBaselineCost(baseline);
  const data: { name: string; value: number; type: 'baseline' | 'saving' | 'total' }[] = [{ name: 'Baseline', value: totalBaseline, type: 'baseline' }];
  
  const structureMap: Record<string, string> = {
    DLC: 'DLC', PILC: 'PILC', OVC: 'OVC',
    'FC-Personal': 'FC_Personal', Maintenance: 'Maintenance',
    OFC: 'OFC', 'RM Losses': 'RM_Losses', 'PM Losses': 'PM_Losses'
  };

  costElements.forEach(el => {
    const structKey = Object.entries(structureMap).find(([, v]) => v === el)?.[0] || el;
    const saving = savingsByStructure[structKey] || 0;
    if (saving !== 0) {
      data.push({ name: el.replace('_', ' '), value: -saving, type: 'saving' });
    }
  });

  const totalSav = Object.values(savingsByStructure).reduce((s, v) => s + v, 0);
  data.push({ name: 'Net Cost', value: totalBaseline - totalSav, type: 'total' });
  return data;
}
