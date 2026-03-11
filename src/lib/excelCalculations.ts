import type { Lever, ImprovementStructure } from '../types/lever';
import type { Baseline, CostElement, Department } from '../types/baseline';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const IMPROVEMENT_STRUCTURES_ORDERED: ImprovementStructure[] = [
  'DLC', 'PILC', 'OVC', 'FC-Personal', 'Maintenance', 'OFC', 'RM Losses', 'PM Losses',
];

export const DEPARTMENTS_ORDERED: string[] = [
  'Manufacturing', 'Supply Chain', 'Maintenance', 'Purchasing', 'Quality',
  'GM', 'HR', 'IT', 'Finance', 'HSE', 'Engineering',
];

/** Map lever.improvementStructure → baseline.costElements key */
export const STRUCTURE_TO_COST_ELEMENT: Record<string, CostElement> = {
  'DLC': 'DLC',
  'PILC': 'PILC',
  'OVC': 'OVC',
  'FC-Personal': 'FC_Personal',
  'Maintenance': 'Maintenance',
  'OFC': 'OFC',
  'RM Losses': 'RM_Losses',
  'PM Losses': 'PM_Losses',
};

/** Display labels for improvement structures in Excel */
export const STRUCTURE_DISPLAY: Record<string, string> = {
  'DLC': 'DLC',
  'PILC': 'PILC',
  'OVC': 'OVC',
  'FC-Personal': 'FC - Personal',
  'Maintenance': 'Maintenance',
  'OFC': 'OFC',
  'RM Losses': 'RM Losses',
  'PM Losses': 'PM Losses',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommitmentBreakdown {
  netSavings: number;
  capex: number;
  approvedCapex: number;
  oneOffOpex: number;
  recurringOpex: number;
  fyTotalSavings: number;
}

export interface GroupAggregation {
  commitment: CommitmentBreakdown;
  additional: CommitmentBreakdown;
  full: CommitmentBreakdown; // commitment + additional
}

export interface StructureAggregation {
  [structure: string]: GroupAggregation;
}

export interface DepartmentAggregation {
  [department: string]: GroupAggregation;
}

export interface PhasingRow {
  baseline: number;
  capex: number;
  byYear: Record<string, number>;     // annual
  commitmentTotal: number;
  fullPotentialTotal: number;
  commitmentByYear?: Record<string, number>;
  fullPotentialByYear?: Record<string, number>;
}

export interface PhasingData {
  [group: string]: PhasingRow;
}

export interface FTEPhasingRow {
  baseline: number;
  byYear: Record<string, number>;     // commitment FTE per year
  commitmentTotal: number;
  fullPotentialTotal: number;
}

export interface FTEPhasingData {
  [department: string]: FTEPhasingRow;
}

export interface CapexPhasingRow {
  capex: number;
  approvedCapex: number;
  oneOffOpex: number;
}

export interface CapexPhasingData {
  byYear: Record<string, CapexPhasingRow>;
  commitmentTotal: CapexPhasingRow;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyBreakdown(): CommitmentBreakdown {
  return { netSavings: 0, capex: 0, approvedCapex: 0, oneOffOpex: 0, recurringOpex: 0, fyTotalSavings: 0 };
}

function addBreakdown(a: CommitmentBreakdown, lever: Lever): CommitmentBreakdown {
  return {
    netSavings: a.netSavings + (lever.netSavingsEUR || 0),
    capex: a.capex + (lever.capexEUR || 0),
    approvedCapex: a.approvedCapex + (lever.approvedCapexEUR || 0),
    oneOffOpex: a.oneOffOpex + (lever.oneOffOpexEUR || 0),
    recurringOpex: a.recurringOpex + (lever.recurringOpexEUR || 0),
    fyTotalSavings: a.fyTotalSavings + (lever.fyTotalSavingsEUR || 0),
  };
}

function sumBreakdowns(a: CommitmentBreakdown, b: CommitmentBreakdown): CommitmentBreakdown {
  return {
    netSavings: a.netSavings + b.netSavings,
    capex: a.capex + b.capex,
    approvedCapex: a.approvedCapex + b.approvedCapex,
    oneOffOpex: a.oneOffOpex + b.oneOffOpex,
    recurringOpex: a.recurringOpex + b.recurringOpex,
    fyTotalSavings: a.fyTotalSavings + b.fyTotalSavings,
  };
}

// ---------------------------------------------------------------------------
// Core aggregation functions (reusable across Excel + UI pages)
// ---------------------------------------------------------------------------

/**
 * Aggregates levers by improvement structure and commitment type.
 * Includes ALL provided levers (caller should pre-filter by inScope if needed).
 */
export function aggregateByStructure(levers: Lever[]): StructureAggregation {
  const result: StructureAggregation = {};

  for (const structure of IMPROVEMENT_STRUCTURES_ORDERED) {
    result[structure] = {
      commitment: emptyBreakdown(),
      additional: emptyBreakdown(),
      full: emptyBreakdown(),
    };
  }

  for (const lever of levers) {
    const s = lever.improvementStructure;
    if (!result[s]) {
      result[s] = {
        commitment: emptyBreakdown(),
        additional: emptyBreakdown(),
        full: emptyBreakdown(),
      };
    }

    if (lever.commitment === 'Commitment') {
      result[s].commitment = addBreakdown(result[s].commitment, lever);
    } else if (lever.commitment === 'Additional Potential') {
      result[s].additional = addBreakdown(result[s].additional, lever);
    }
    result[s].full = sumBreakdowns(result[s].commitment, result[s].additional);
  }

  return result;
}

/**
 * Aggregates levers by department and commitment type.
 */
export function aggregateByDepartment(levers: Lever[]): DepartmentAggregation {
  const result: DepartmentAggregation = {};

  for (const dept of DEPARTMENTS_ORDERED) {
    result[dept] = {
      commitment: emptyBreakdown(),
      additional: emptyBreakdown(),
      full: emptyBreakdown(),
    };
  }

  for (const lever of levers) {
    const d = lever.department;
    if (!result[d]) {
      result[d] = {
        commitment: emptyBreakdown(),
        additional: emptyBreakdown(),
        full: emptyBreakdown(),
      };
    }

    if (lever.commitment === 'Commitment') {
      result[d].commitment = addBreakdown(result[d].commitment, lever);
    } else if (lever.commitment === 'Additional Potential') {
      result[d].additional = addBreakdown(result[d].additional, lever);
    }
    result[d].full = sumBreakdowns(result[d].commitment, result[d].additional);
  }

  return result;
}

/**
 * Calculates annual savings phasing by improvement structure or department.
 * Only counts levers with inScope === true.
 */
export function calcAnnualPhasing(
  levers: Lever[],
  years: number[],
  groupBy: 'structure' | 'department',
  baselines: Baseline[],
): PhasingData {
  const inScopeLevers = levers.filter(l => l.inScope);
  const groups = groupBy === 'structure' ? IMPROVEMENT_STRUCTURES_ORDERED : DEPARTMENTS_ORDERED;

  const result: PhasingData = {};

  for (const group of groups) {
    const byYear: Record<string, number> = {};
    const commitmentByYear: Record<string, number> = {};
    const fullPotentialByYear: Record<string, number> = {};

    for (const year of years) {
      const yStr = String(year);
      byYear[yStr] = 0;
      commitmentByYear[yStr] = 0;
      fullPotentialByYear[yStr] = 0;
    }

    const groupLevers = inScopeLevers.filter(l =>
      groupBy === 'structure' ? l.improvementStructure === group : l.department === group
    );

    for (const lever of groupLevers) {
      for (const year of years) {
        const yStr = String(year);
        const val = lever.savingsByYear?.[yStr] || 0;
        fullPotentialByYear[yStr] += val;
        if (lever.commitment === 'Commitment') {
          commitmentByYear[yStr] += val;
        }
        byYear[yStr] += val;
      }
    }

    // Baseline: sum across all baselines for this group
    let baselineValue = 0;
    if (groupBy === 'structure') {
      const ceKey = STRUCTURE_TO_COST_ELEMENT[group];
      if (ceKey) {
        baselineValue = baselines.reduce((sum, b) => sum + (b.costElements?.[ceKey] || 0), 0);
      }
    } else {
      // For department, baseline FTE costs are harder to map directly
      // Use FTE × implied cost rate (simplified: not available directly, use 0)
      baselineValue = 0;
    }

    // CAPEX: sum of inScope levers for this group
    const capex = groupLevers.reduce((sum, l) => sum + (l.capexEUR || 0), 0);
    const commitmentTotal = groupLevers
      .filter(l => l.commitment === 'Commitment')
      .reduce((sum, l) => sum + (l.netSavingsEUR || 0), 0);
    const fullPotentialTotal = groupLevers.reduce((sum, l) => sum + (l.netSavingsEUR || 0), 0);

    result[group] = {
      baseline: baselineValue,
      capex,
      byYear,
      commitmentTotal,
      fullPotentialTotal,
      commitmentByYear,
      fullPotentialByYear,
    };
  }

  return result;
}

/**
 * Converts annual phasing data to cumulated (running sum) phasing data.
 */
export function calcCumulatedPhasing(annualData: PhasingData, years: number[]): PhasingData {
  const result: PhasingData = {};

  for (const [group, row] of Object.entries(annualData)) {
    const byYear: Record<string, number> = {};
    const commitmentByYear: Record<string, number> = {};
    const fullPotentialByYear: Record<string, number> = {};

    let runSum = 0;
    let commitRunSum = 0;
    let fullRunSum = 0;

    for (const year of years) {
      const yStr = String(year);
      runSum += row.byYear[yStr] || 0;
      commitRunSum += (row.commitmentByYear?.[yStr] || 0);
      fullRunSum += (row.fullPotentialByYear?.[yStr] || 0);
      byYear[yStr] = runSum;
      commitmentByYear[yStr] = commitRunSum;
      fullPotentialByYear[yStr] = fullRunSum;
    }

    result[group] = {
      ...row,
      byYear,
      commitmentByYear,
      fullPotentialByYear,
    };
  }

  return result;
}

/**
 * Calculates FTE savings phasing by department and year.
 * Uses kpiImpactYear to determine which year FTE savings land.
 */
export function calcFTEPhasing(
  levers: Lever[],
  baselines: Baseline[],
  years: number[],
): FTEPhasingData {
  const result: FTEPhasingData = {};
  const inScopeLevers = levers.filter(l => l.inScope);

  // Build FTE baseline by department (sum across all baselines)
  const fteBaseline: Record<string, number> = {};
  for (const dept of DEPARTMENTS_ORDERED) {
    const deptKey = dept.replace(' ', '_') as Department;
    fteBaseline[dept] = baselines.reduce((sum, b) => sum + (b.fteByDepartment?.[deptKey] || 0), 0);
  }

  for (const dept of DEPARTMENTS_ORDERED) {
    const byYear: Record<string, number> = {};
    for (const year of years) {
      byYear[String(year)] = 0;
    }

    const deptLevers = inScopeLevers.filter(l => l.department === dept);

    // FTE savings land in kpiImpactYear
    for (const lever of deptLevers) {
      const impactYear = lever.kpiImpactYear || lever.capexImpactYear;
      if (impactYear && byYear[impactYear] !== undefined && lever.commitment === 'Commitment') {
        byYear[impactYear] += lever.fte || 0;
      }
    }

    const commitmentTotal = deptLevers
      .filter(l => l.commitment === 'Commitment')
      .reduce((sum, l) => sum + (l.fte || 0), 0);
    const fullPotentialTotal = deptLevers.reduce((sum, l) => sum + (l.fte || 0), 0);

    result[dept] = {
      baseline: fteBaseline[dept] || 0,
      byYear,
      commitmentTotal,
      fullPotentialTotal,
    };
  }

  return result;
}

/**
 * Calculates CAPEX & One-Off OPEX phasing by year (commitment levers only).
 * Uses capexImpactYear for CAPEX, kpiImpactYear for OPEX.
 */
export function calcCapexPhasing(levers: Lever[], years: number[]): CapexPhasingData {
  const commitLevers = levers.filter(l => l.commitment === 'Commitment');
  const byYear: Record<string, CapexPhasingRow> = {};

  for (const year of years) {
    byYear[String(year)] = { capex: 0, approvedCapex: 0, oneOffOpex: 0 };
  }

  for (const lever of commitLevers) {
    const capexYear = lever.capexImpactYear;
    if (capexYear && byYear[capexYear]) {
      byYear[capexYear].capex += lever.capexEUR || 0;
      byYear[capexYear].approvedCapex += lever.approvedCapexEUR || 0;
    }

    const opexYear = lever.kpiImpactYear || lever.capexImpactYear;
    if (opexYear && byYear[opexYear]) {
      byYear[opexYear].oneOffOpex += lever.oneOffOpexEUR || 0;
    }
  }

  const commitmentTotal: CapexPhasingRow = {
    capex: commitLevers.reduce((s, l) => s + (l.capexEUR || 0), 0),
    approvedCapex: commitLevers.reduce((s, l) => s + (l.approvedCapexEUR || 0), 0),
    oneOffOpex: commitLevers.reduce((s, l) => s + (l.oneOffOpexEUR || 0), 0),
  };

  return { byYear, commitmentTotal };
}

/**
 * Computes cumulated CAPEX phasing.
 */
export function calcCumulatedCapexPhasing(annual: CapexPhasingData, years: number[]): CapexPhasingData {
  const byYear: Record<string, CapexPhasingRow> = {};
  let sumCapex = 0, sumApproved = 0, sumOpex = 0;

  for (const year of years) {
    const yStr = String(year);
    sumCapex += annual.byYear[yStr]?.capex || 0;
    sumApproved += annual.byYear[yStr]?.approvedCapex || 0;
    sumOpex += annual.byYear[yStr]?.oneOffOpex || 0;
    byYear[yStr] = { capex: sumCapex, approvedCapex: sumApproved, oneOffOpex: sumOpex };
  }

  return { byYear, commitmentTotal: annual.commitmentTotal };
}

/**
 * Returns total baseline costs across all baselines for a given set of cost elements.
 */
export function getTotalBaselineCosts(
  baselines: Baseline[],
  elements?: CostElement[],
): number {
  const keys = elements || (['RM', 'PM', 'DLC', 'PILC', 'OVC', 'FC_Personal', 'Maintenance', 'OFC', 'RM_Losses', 'PM_Losses'] as CostElement[]);
  return baselines.reduce((sum, b) => {
    return sum + keys.reduce((s, k) => s + (b.costElements?.[k] || 0), 0);
  }, 0);
}

/**
 * Returns total conversion cost (excludes RM and PM) across all baselines.
 */
export function getTotalConversionCost(baselines: Baseline[]): number {
  const ccElements: CostElement[] = ['DLC', 'PILC', 'OVC', 'FC_Personal', 'Maintenance', 'OFC', 'RM_Losses', 'PM_Losses'];
  return getTotalBaselineCosts(baselines, ccElements);
}
